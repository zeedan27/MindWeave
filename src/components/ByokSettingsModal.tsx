'use client';

import { useEffect, useState } from 'react';
import { Eye, EyeOff, KeyRound, ShieldCheck, X } from 'lucide-react';
import type { AIProviderId, RuntimeAIConfig } from '@/lib/schemas';
import { useWorkspaceStore } from '@/store/workspace-store';

const PROVIDER_OPTIONS: Array<{
  id: AIProviderId;
  label: string;
  defaultBaseUrl: string;
  defaultModel: string;
  needsKey: boolean;
  hint: string;
}> = [
  {
    id: 'openai',
    label: 'OpenAI',
    defaultBaseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    needsKey: true,
    hint: 'Standard OpenAI Chat Completions key (sk-...).',
  },
  {
    id: 'groq',
    label: 'Groq',
    defaultBaseUrl: 'https://api.groq.com/openai/v1',
    defaultModel: 'llama-3.3-70b-versatile',
    needsKey: true,
    hint: 'Ultra-fast Llama 3.3 inference via console.groq.com.',
  },
  {
    id: 'google',
    label: 'Google Gemini',
    defaultBaseUrl: '',
    defaultModel: 'gemini-2.0-flash',
    needsKey: true,
    hint: 'Google AI Studio Gemini key (AIza...).',
  },
  {
    id: 'anthropic',
    label: 'Anthropic Claude',
    defaultBaseUrl: 'https://api.anthropic.com/v1',
    defaultModel: 'claude-3-5-haiku-20241022',
    needsKey: true,
    hint: 'Anthropic Messages API key (sk-ant-...).',
  },
  {
    id: 'tokens_bd',
    label: 'Tokens.bd Gateway',
    defaultBaseUrl: 'https://tokens.bd/v1',
    defaultModel: 'deepseek-ai/deepseek-v4.1-flash-1017',
    needsKey: true,
    hint: '45+ frontier models with one tok_live_... key via https://tokens.bd/v1.',
  },
  {
    id: 'ollama',
    label: 'Ollama (Local)',
    defaultBaseUrl: 'http://localhost:11434/v1',
    defaultModel: 'llama3.2',
    needsKey: false,
    hint: 'Local OpenAI-compatible runtime on localhost:11434 (no API key needed).',
  },
];

export default function ByokSettingsModal() {
  const { byokModalOpen, setByokModalOpen, byokConfig, updateByokConfig } = useWorkspaceStore();

  const [provider, setProvider] = useState<AIProviderId>(byokConfig.provider);
  const [apiKey, setApiKey] = useState(byokConfig.apiKey || '');
  const [baseUrl, setBaseUrl] = useState(byokConfig.baseUrl || '');
  const [model, setModel] = useState(byokConfig.model || '');
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    if (byokModalOpen) {
      setProvider(byokConfig.provider);
      setApiKey(byokConfig.apiKey || '');
      setBaseUrl(byokConfig.baseUrl || '');
      setModel(byokConfig.model || '');
    }
  }, [byokModalOpen, byokConfig]);

  useEffect(() => {
    if (!byokModalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setByokModalOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [byokModalOpen, setByokModalOpen]);

  if (!byokModalOpen) return null;

  const activeMeta = PROVIDER_OPTIONS.find((p) => p.id === provider) || PROVIDER_OPTIONS[0];

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const nextConfig: RuntimeAIConfig = {
      provider,
      apiKey: apiKey.trim() || undefined,
      baseUrl: baseUrl.trim() || undefined,
      model: model.trim() || undefined,
      explicitlyConfigured: Boolean(apiKey.trim() || provider === 'ollama'),
    };
    updateByokConfig(nextConfig);
    setByokModalOpen(false);
  };

  const handleClear = () => {
    updateByokConfig({ provider: 'openai', explicitlyConfigured: false });
    setByokModalOpen(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45"
      role="dialog"
      aria-modal="true"
      aria-labelledby="byok-modal-title"
      onClick={() => setByokModalOpen(false)}
    >
      <div
        className="w-full max-w-lg rounded-xl border p-6"
        style={{
          backgroundColor: 'var(--mw-card)',
          borderColor: 'var(--mw-border)',
          boxShadow: 'var(--mw-shadow-lift)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-2.5">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center border"
              style={{
                backgroundColor: 'var(--mw-primary-soft)',
                color: 'var(--mw-primary)',
                borderColor: 'var(--mw-border)',
              }}
            >
              <KeyRound className="w-4 h-4" />
            </div>
            <div>
              <h2 id="byok-modal-title" className="text-lg font-semibold leading-tight">
                AI Provider & Key Settings
              </h2>
              <p className="text-xs mt-0.5" style={{ color: 'var(--mw-muted)' }}>
                Hybrid mode: uses your browser key when set, or server .env / offline mode.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setByokModalOpen(false)}
            className="w-9 h-9 rounded-lg flex items-center justify-center border hover:opacity-80"
            style={{ borderColor: 'var(--mw-border)', color: 'var(--mw-muted)' }}
            aria-label="Close AI settings"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label htmlFor="ai-provider-select" className="block text-xs font-semibold mb-1.5">
              Provider
            </label>
            <select
              id="ai-provider-select"
              value={provider}
              onChange={(e) => setProvider(e.target.value as AIProviderId)}
              className="w-full h-10 px-3 rounded-lg border text-sm"
              style={{
                backgroundColor: 'var(--mw-card)',
                borderColor: 'var(--mw-border)',
                color: 'var(--mw-ink)',
              }}
            >
              {PROVIDER_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
            <p className="text-xs mt-1" style={{ color: 'var(--mw-muted)' }}>
              {activeMeta.hint}
            </p>
          </div>

          {activeMeta.needsKey && (
            <div>
              <label htmlFor="ai-api-key-input" className="block text-xs font-semibold mb-1.5">
                API Key
              </label>
              <div className="relative flex items-center">
                <input
                  id="ai-api-key-input"
                  type={showKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Paste API key (stored locally in your browser)"
                  className="w-full h-10 pl-3 pr-10 rounded-lg border text-sm font-mono"
                  style={{
                    backgroundColor: 'var(--mw-card)',
                    borderColor: 'var(--mw-border)',
                    color: 'var(--mw-ink)',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowKey((s) => !s)}
                  className="absolute right-2 p-1.5 rounded-md"
                  style={{ color: 'var(--mw-muted)' }}
                  aria-label={showKey ? 'Hide API key' : 'Show API key'}
                >
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="ai-model-input" className="block text-xs font-semibold mb-1.5">
                Model Override (optional)
              </label>
              <input
                id="ai-model-input"
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder={activeMeta.defaultModel}
                className="w-full h-10 px-3 rounded-lg border text-xs font-mono"
                style={{
                  backgroundColor: 'var(--mw-card)',
                  borderColor: 'var(--mw-border)',
                  color: 'var(--mw-ink)',
                }}
              />
            </div>

            <div>
              <label htmlFor="ai-baseurl-input" className="block text-xs font-semibold mb-1.5">
                Base URL (optional)
              </label>
              <input
                id="ai-baseurl-input"
                type="url"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder={activeMeta.defaultBaseUrl || 'Default SDK endpoint'}
                className="w-full h-10 px-3 rounded-lg border text-xs font-mono"
                style={{
                  backgroundColor: 'var(--mw-card)',
                  borderColor: 'var(--mw-border)',
                  color: 'var(--mw-ink)',
                }}
              />
            </div>
          </div>

          <div
            className="flex items-start gap-2.5 p-3 rounded-lg border text-xs"
            style={{
              backgroundColor: 'var(--mw-bg)',
              borderColor: 'var(--mw-border)',
              color: 'var(--mw-muted)',
            }}
          >
            <ShieldCheck
              className="w-4 h-4 flex-shrink-0 mt-0.5"
              style={{ color: 'var(--mw-emerald)' }}
            />
            <span>
              Your key stays in browser <code className="font-mono">localStorage</code>, is never
              saved on disk server-side, and is scrubbed from all logs.
            </span>
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={handleClear}
              className="px-3 h-10 rounded-lg border text-xs font-medium hover:opacity-80"
              style={{ borderColor: 'var(--mw-border)', color: 'var(--mw-muted)' }}
            >
              Reset to Default / Offline
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setByokModalOpen(false)}
                className="px-4 h-10 rounded-lg border text-sm font-medium"
                style={{ borderColor: 'var(--mw-border)', color: 'var(--mw-ink)' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 h-10 rounded-lg text-sm font-medium transition-colors"
                style={{
                  backgroundColor: 'var(--mw-primary)',
                  color: 'var(--mw-primary-ink)',
                }}
              >
                Save Provider
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
