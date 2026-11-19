import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  AIProviderId,
  AIProviderIdSchema,
  RuntimeAIConfig,
  RuntimeAIConfigSchema,
  isAllowedAiBaseUrl,
} from '@/lib/schemas';

export interface ProviderMeta {
  id: AIProviderId;
  label: string;
  defaultBaseUrl: string;
  defaultModel: string;
  requiresKey: boolean;
}

export const PROVIDER_DEFAULTS: Record<AIProviderId, ProviderMeta> = {
  openai: {
    id: 'openai',
    label: 'OpenAI',
    defaultBaseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    requiresKey: true,
  },
  groq: {
    id: 'groq',
    label: 'Groq',
    defaultBaseUrl: 'https://api.groq.com/openai/v1',
    defaultModel: 'llama-3.3-70b-versatile',
    requiresKey: true,
  },
  google: {
    id: 'google',
    label: 'Google Gemini',
    defaultBaseUrl: '',
    defaultModel: 'gemini-2.0-flash',
    requiresKey: true,
  },
  anthropic: {
    id: 'anthropic',
    label: 'Anthropic Claude',
    defaultBaseUrl: 'https://api.anthropic.com/v1',
    defaultModel: 'claude-3-5-haiku-20241022',
    requiresKey: true,
  },
  tokens_bd: {
    id: 'tokens_bd',
    label: 'Tokens.bd Gateway',
    defaultBaseUrl: 'https://tokens.bd/v1',
    defaultModel: 'deepseek-ai/deepseek-v4.1-flash-1017',
    requiresKey: true,
  },
  ollama: {
    id: 'ollama',
    label: 'Ollama (Local)',
    defaultBaseUrl: 'http://localhost:11434/v1',
    defaultModel: 'llama3.2',
    requiresKey: false,
  },
};

export function parseByokHeader(headerValue: string | null): RuntimeAIConfig | null {
  if (!headerValue || headerValue.trim().length === 0) return null;
  try {
    const jsonStr = Buffer.from(headerValue.trim(), 'base64').toString('utf8');
    const rawObj = JSON.parse(jsonStr) as Record<string, unknown>;
    const normalized = {
      ...rawObj,
      apiKey:
        typeof rawObj.apiKey === 'string' && rawObj.apiKey.trim().length > 0
          ? rawObj.apiKey.trim()
          : undefined,
      baseUrl:
        typeof rawObj.baseUrl === 'string' && rawObj.baseUrl.trim().length > 0
          ? rawObj.baseUrl.trim()
          : undefined,
      model:
        typeof rawObj.model === 'string' && rawObj.model.trim().length > 0
          ? rawObj.model.trim()
          : undefined,
      explicitlyConfigured: true,
    };
    const parsed = RuntimeAIConfigSchema.safeParse(normalized);
    if (!parsed.success) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

export function resolveRuntimeAIConfig(headers?: Headers): RuntimeAIConfig {
  const byok = headers ? parseByokHeader(headers.get('x-mindweave-ai-config')) : null;
  if (byok && (byok.apiKey || byok.provider === 'ollama')) {
    return byok;
  }

  const rawProvider = process.env.AI_PROVIDER?.trim() || 'openai';
  const providerParsed = AIProviderIdSchema.safeParse(rawProvider);
  const provider: AIProviderId = providerParsed.success ? providerParsed.data : 'openai';
  const apiKey = process.env.AI_API_KEY?.trim() || undefined;
  const rawBaseUrl = process.env.AI_BASE_URL?.trim() || undefined;
  const baseUrl = rawBaseUrl && isAllowedAiBaseUrl(rawBaseUrl) ? rawBaseUrl : undefined;
  const model = process.env.AI_MODEL?.trim() || undefined;

  return {
    provider,
    apiKey,
    baseUrl,
    model,
    explicitlyConfigured: Boolean(apiKey || process.env.AI_PROVIDER?.trim() === 'ollama'),
  };
}

export function isLiveAIConfigured(config: RuntimeAIConfig): boolean {
  if (config.provider === 'ollama') {
    return Boolean(config.explicitlyConfigured);
  }
  return Boolean(config.apiKey && config.apiKey.trim().length > 0);
}

export interface AICompletionRequest {
  config: RuntimeAIConfig;
  systemPrompt: string;
  userPrompt: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  temperature?: number;
  maxTokens?: number;
}

export async function runAICompletion(req: AICompletionRequest): Promise<string> {
  const { config, systemPrompt, userPrompt, history = [], temperature = 0.4, maxTokens = 4096 } = req;
  const defaults = PROVIDER_DEFAULTS[config.provider];
  const model = config.model || defaults.defaultModel;

  if (!isLiveAIConfigured(config)) {
    throw new Error('AI_KEY_MISSING');
  }

  if (config.provider === 'google') {
    const genAI = new GoogleGenerativeAI(config.apiKey || '');
    const genModel = genAI.getGenerativeModel({ model });
    const geminiHistory = history.map((msg) => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }],
    }));

    const chat = genModel.startChat({
      history: geminiHistory,
      generationConfig: { temperature, maxOutputTokens: maxTokens },
    });

    const promptText = `${systemPrompt}\n\n${userPrompt}`;
    const result = await chat.sendMessage(promptText);
    return result.response.text();
  }

  if (config.provider === 'anthropic') {
    const baseUrl = (config.baseUrl || defaults.defaultBaseUrl).replace(/\/+$/, '');
    const messagesUrl = baseUrl.endsWith('/v1') ? `${baseUrl}/messages` : `${baseUrl}/v1/messages`;

    const response = await fetch(messagesUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': config.apiKey || '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        temperature,
        system: systemPrompt,
        messages: [
          ...history.map((m) => ({ role: m.role, content: m.content })),
          { role: 'user', content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`Anthropic API error (${response.status}): ${text.slice(0, 240)}`);
    }

    const payload = (await response.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };
    return payload.content?.find((b) => b.type === 'text')?.text ?? '';
  }

  // OpenAI, Groq, Tokens.bd, Ollama via OpenAI-compatible SDK
  const baseURL = config.baseUrl || defaults.defaultBaseUrl;
  const client = new OpenAI({
    apiKey: config.apiKey || 'ollama',
    baseURL,
    maxRetries: 2,
  });

  const completion = await client.chat.completions.create({
    model,
    temperature,
    max_tokens: maxTokens,
    messages: [
      { role: 'system', content: systemPrompt },
      ...history.map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content: userPrompt },
    ],
  });

  return completion.choices[0]?.message?.content ?? '';
}
