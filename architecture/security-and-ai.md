# SOP: Security, Boundary Validation & Multi-Provider AI Gateway

## 1. Boundary Validation & Contracts
- All API route inputs (`POST /api/weave`, `/api/expand`, `/api/lens`, `/api/blindspots`, `/api/study/evaluate`, `/api/chat`) must validate payloads via Zod schemas in `src/lib/schemas.ts`.
- Invalid requests fail fast with HTTP `400`, `VALIDATION_ERROR`, machine-readable `details`, and `x-request-id`.

## 2. Secret Hygiene & SSRF Prevention
- Client BYOK configuration is supplied via `x-mindweave-ai-config` (Base64-encoded UTF-8 JSON) and validated strictly against `RuntimeAIConfigSchema`.
- `isAllowedAiBaseUrl()` allows only `https://` remote URLs or explicit local loopback `http://localhost` / `http://127.0.0.1` (for local Ollama). Private link-local/metadata IPs (`169.254.*`, `10.*`, `192.168.*`, non-HTTPS remote HTTP) are rejected.
- `src/lib/logger.ts` recursively scrubs `apiKey`, `api_key`, `authorization`, `token`, and `x-mindweave-ai-config` to `[REDACTED]` before printing structured JSON logs.
- All API JSON responses emit `Cache-Control: private, no-store`.

## 3. Rate Limiting
- `src/lib/rate-limit.ts` enforces a sliding-window token limit (default `30` requests per `60_000` ms per client IP/key) on AI inference routes.
- Over-limit callers receive HTTP `429` with `RATE_LIMITED` and a `Retry-After` header.

## 4. Multi-Provider Gateway & JSON Self-Healing
- `src/lib/ai/gateway.ts` resolves config in priority order: (1) valid request BYOK header (`x-mindweave-ai-config`), (2) server `.env` (`AI_PROVIDER`, `AI_API_KEY`, `AI_BASE_URL`, `AI_MODEL`). `AICompletionRequest` accepts `jsonMode?: boolean`, enabling native JSON mode (`response_format: { type: 'json_object' }` with automatic HTTP `400` fallback `ai.json_mode.fallback` for OpenAI-compatible endpoints, and `responseMimeType: 'application/json'` for Google Gemini) and emitting structured truncation warnings (`ai.completion.truncated`) when `finish_reason === 'length'`, `stop_reason === 'max_tokens'`, or `finishReason === 'MAX_TOKENS'`.
- Supported providers:
  - `openai` (`https://api.openai.com/v1`, default `gpt-4o-mini`)
  - `groq` (`https://api.groq.com/openai/v1`, default `llama-3.3-70b-versatile`)
  - `google` (native `@google/generative-ai`, default `gemini-2.0-flash`)
  - `anthropic` (`https://api.anthropic.com/v1` with `anthropic-version: 2023-06-01`, default `claude-3-5-haiku-20241022`)
  - `tokens_bd` (`https://tokens.bd/v1`, default `deepseek-ai/deepseek-v4.1-flash-1017`, per `tokens-bd-api` skill)
  - `ollama` (`http://localhost:11434/v1`, default `llama3.2`, optional empty key treated as `'ollama'`)
- `src/lib/ai/json-guard.ts` performs fence-safe balanced `{...}`/`[...]` extraction (preserving triple backticks inside JSON strings), single-pass string control-char & invalid backslash escaping (e.g., LaTeX `\sqrt`, `\frac`), string-aware trailing-comma stripping, and schema-verified truncated-JSON repair fallback before Zod validation.
