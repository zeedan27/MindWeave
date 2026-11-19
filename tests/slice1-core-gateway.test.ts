import { describe, expect, it, beforeEach } from 'vitest';
import { isAllowedAiBaseUrl, MindMapWorkspaceSchema } from '@/lib/schemas';
import { redactSecrets, createRequestId } from '@/lib/logger';
import { checkRateLimit, resetRateLimitStore } from '@/lib/rate-limit';
import { extractAndValidateJson, extractJsonSubstring } from '@/lib/ai/json-guard';
import { parseByokHeader, isLiveAIConfigured, resolveRuntimeAIConfig } from '@/lib/ai/gateway';
import { z } from 'zod';

describe('Slice 1: Core Domain Contracts, Logger, Rate Limiter & AI Gateway', () => {
  beforeEach(() => {
    resetRateLimitStore();
  });

  it('validates SSRF URL allowlist cleanly', () => {
    expect(isAllowedAiBaseUrl('https://tokens.bd/v1')).toBe(true);
    expect(isAllowedAiBaseUrl('https://api.openai.com/v1')).toBe(true);
    expect(isAllowedAiBaseUrl('http://localhost:11434/v1')).toBe(true);
    expect(isAllowedAiBaseUrl('http://127.0.0.1:11434/v1')).toBe(true);
    expect(isAllowedAiBaseUrl('http://169.254.169.254/latest/meta-data')).toBe(false);
    expect(isAllowedAiBaseUrl('https://169.254.169.254/v1')).toBe(false);
    expect(isAllowedAiBaseUrl('http://remote-host.example/v1')).toBe(false);
    expect(isAllowedAiBaseUrl('ftp://tokens.bd/v1')).toBe(false);
  });

  it('redacts sensitive secrets recursively and issues unique requestIds', () => {
    const reqId = createRequestId();
    expect(reqId.startsWith('req_')).toBe(true);

    const scrubbed = redactSecrets({
      requestId: reqId,
      apiKey: 'sk-secret-value',
      nested: {
        authorization: 'Bearer abc',
        'x-mindweave-ai-config': 'base64value',
        safeField: 'hello',
      },
    }) as Record<string, unknown>;

    expect(scrubbed.apiKey).toBe('[REDACTED]');
    expect((scrubbed.nested as Record<string, unknown>).authorization).toBe('[REDACTED]');
    expect((scrubbed.nested as Record<string, unknown>)['x-mindweave-ai-config']).toBe('[REDACTED]');
    expect((scrubbed.nested as Record<string, unknown>).safeField).toBe('hello');
  });

  it('enforces sliding-window rate limits with Retry-After seconds', () => {
    const key = 'weave:127.0.0.1';
    expect(checkRateLimit(key, 2, 10_000, 1000)).toEqual({
      allowed: true,
      remaining: 1,
      retryAfterSec: 0,
    });
    expect(checkRateLimit(key, 2, 10_000, 2000)).toEqual({
      allowed: true,
      remaining: 0,
      retryAfterSec: 0,
    });
    const blocked = checkRateLimit(key, 2, 10_000, 3000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSec).toBe(8);
  });

  it('extracts and validates fenced or prose-wrapped JSON payloads', () => {
    const raw = `Here is the generated structure:\n\`\`\`json\n{"topic":"Attention","items":["Q","K","V"]}\n\`\`\`\nHope this helps!`;
    const schema = z.object({ topic: z.string(), items: z.array(z.string()) });

    expect(extractJsonSubstring(raw)).toBe('{"topic":"Attention","items":["Q","K","V"]}');
    const result = extractAndValidateJson(raw, schema);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.items).toEqual(['Q', 'K', 'V']);
    }
  });

  it('parses Base64 BYOK headers and rejects invalid baseUrl SSRF attempts', () => {
    const validHeader = Buffer.from(
      JSON.stringify({
        provider: 'tokens_bd',
        apiKey: 'tok_live_sample_key',
        baseUrl: 'https://tokens.bd/v1',
        model: 'deepseek-ai/deepseek-v4.1-flash-1017',
      })
    ).toString('base64');

    const parsed = parseByokHeader(validHeader);
    expect(parsed?.provider).toBe('tokens_bd');
    expect(isLiveAIConfigured(parsed!)).toBe(true);

    const ssrfHeader = Buffer.from(
      JSON.stringify({
        provider: 'openai',
        apiKey: 'sk-test',
        baseUrl: 'http://169.254.169.254/latest',
      })
    ).toString('base64');
    expect(parseByokHeader(ssrfHeader)).toBeNull();

    const headers = new Headers({ 'x-mindweave-ai-config': validHeader });
    const resolved = resolveRuntimeAIConfig(headers);
    expect(resolved.provider).toBe('tokens_bd');
  });

  it('validates a full MindMapWorkspace domain object', () => {
    const valid = MindMapWorkspaceSchema.safeParse({
      id: 'ws_1',
      schemaVersion: 1,
      title: 'Attention Is All You Need',
      subtitle: 'Paper synthesis',
      layoutMode: 'balanced',
      sources: [
        {
          id: 'src_1',
          type: 'pdf',
          title: 'Vaswani et al. 2017',
          originLabel: 'attention.pdf',
          fileName: 'attention.pdf',
          rawTextHash: 'abcd1234ef567890',
          segments: [{ id: 'src_1-seg-0', sourceId: 'src_1', index: 0, text: 'Self-attention', pageNumber: 1 }],
          createdAt: 1700000000000,
        },
      ],
      rootNode: {
        id: 'root',
        parentId: null,
        topic: 'Transformers',
        summary: 'Sequence transduction via attention',
        level: 0,
        children: [],
        anchors: [],
        lenses: [],
        mastery: 'untested',
      },
      crossLinks: [],
      blindSpots: [],
      walkthrough: [],
      chatMessages: [],
      createdAt: 1700000000000,
      updatedAt: 1700000000000,
    });
    expect(valid.success).toBe(true);
  });
});
