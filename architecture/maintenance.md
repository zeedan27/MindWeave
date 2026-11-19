# MindWeave — Maintenance & Operations Runbook

> **Status:** Production-Ready Runbook (Phase 5 Finalized — Tier T0 Local-First Workspace)

---

## 1. Environment Variables & AI Gateway Defaults

All configuration keys are enumerated with blank values in [`.env.example`](../.env.example). Local secrets live strictly in `.env` (gitignored) and are never committed or shipped in client bundles.

| Variable | Required | Description |
|---|---|---|
| `AI_PROVIDER` | No | Default server provider (`openai`, `groq`, `google`, `anthropic`, `tokens_bd`, or `ollama`). Falls back to built-in offline demo/deterministic extraction if unset. |
| `AI_API_KEY` | No | Server-side provider API credential (not needed for local `ollama` or client BYOK usage). |
| `AI_BASE_URL` | No | Optional custom base URL (must pass `isAllowedAiBaseUrl`: `https://` remote or `http://localhost` / `http://127.0.0.1`). |
| `AI_MODEL` | No | Model override (e.g. `gpt-4o-mini`, `llama-3.3-70b-versatile`, `gemini-2.0-flash`, `claude-3-5-haiku-20241022`, `deepseek-ai/deepseek-v4.1-flash-1017`). |
| `DATABASE_URL` | No | Reserved for T1+ Postgres/Supabase cloud sync migration; unused in T0 (`IndexedDB` + `localStorage`). |

### Client-Side BYOK Handling
- Users configure per-browser provider credentials via **BYOK Settings** (`src/components/ByokSettingsModal.tsx`), persisted solely in browser `localStorage` (`mindweave_byok_config`).
- When invoking AI Route Handlers, the browser attaches `x-mindweave-ai-config` (base64 JSON) in-memory per request.
- Server routes resolve runtime credentials via `resolveRuntimeAIConfig(request.headers)`, never persist client keys to disk/database, and redact `apiKey`, `authorization`, and `x-mindweave-ai-config` via `redactSecrets()` in `src/lib/logger.ts`.

---

## 2. Health, Readiness Probes & HTTP Caching Policy

| Endpoint | Purpose | Response & Headers |
|---|---|---|
| `GET /api/healthz/live` | Process liveness probe (zero external dependencies) | HTTP `200`, `Cache-Control: private, no-store`, JSON `{ "ok": true, "status": "live", "uptimeSec": <number> }` |
| `GET /api/healthz/ready` | Readiness & AI availability probe | HTTP `200`, `Cache-Control: private, no-store`, JSON `{ "ok": true, "status": "ready", "aiServerConfigured": <boolean>, "provider": <string \| null>, "demoAvailable": true }` |

### Caching & Rate-Limiting Posture
- **Hashed Next.js static assets (`/_next/static/*`)**: Immutable long-lived cache managed by Next.js build pipeline.
- **Health probes & AI API routes (`/api/*`)**: `Cache-Control: private, no-store` to prevent credential/workspace leakage across edge caches.
- **Abuse & Credit Protection**: `checkRateLimit()` (`src/lib/rate-limit.ts`) applies an in-memory sliding window (`30 req/min` default per client IP/scope) across AI endpoints, returning HTTP `429` (`RATE_LIMITED`) with `retryAfterSec` / `Retry-After`.
- **Graceful Shutdown & Proxy Alignment**: Stateless App Router route handlers complete in-flight requests cleanly on `SIGTERM`. When placed behind an Nginx/Cloudflare/Vercel reverse proxy, align upstream idle timeout (`<= 60s`) with server keep-alive (`65s`).

---

## 3. Deployment & Rollback Procedure (S.C.O.P.E. Deploy Rule)

1. **Pre-Deploy Verification Gate**:
   - Confirm clean working tree (`git status`) and run CI / Gate 2 verification:
     ```bash
     npm run verify:connections && npm run typecheck && npm run lint && npm test && npm run build && npm run verify:gate2
     ```
2. **Approved Deployment Path**:
   - Push only committed code to the Git repository connected to CI (`.github/workflows/ci.yml`) or deploy via a vetted host CLI after preview/staging smoke testing (`/browser` check on `/`, `/api/healthz/live`, `/api/healthz/ready`).
   - Never deploy using folder-upload tools or unignored local directories.
3. **Rollback Procedure**:
   1. Inspect recent releases: `git log --oneline -5`.
   2. Revert the regression cleanly (`git revert <bad-commit-sha>`) or re-deploy the prior passing commit tag.
   3. Re-run `npm run verify:connections && npm run typecheck && npm run lint && npm test && npm run build && npm run verify:gate2`.
   4. Verify `GET /api/healthz/live` and `GET /api/healthz/ready` return HTTP `200` on the restored deployment.
4. **Client Workspace Recovery**:
   - Users can restore local workspaces from `.mindweave.json` exports via **Import Map**, or extract raw browser workspace JSON from the Fatal Error boundary (`src/app/error.tsx`).

---

## 4. Secret Rotation Guide

1. **Server `.env` Key Compromise or Routine Rotation**:
   - Revoke/regenerate the compromised token in the upstream provider dashboard (OpenAI, Groq, Google AI Studio, Anthropic Console, or Tokens.bd).
   - Update `AI_API_KEY` in `.env` (local) or host secret manager (staging/production).
   - Restart the Next.js server process (`npm run start`) and confirm `GET /api/healthz/ready` reports `"aiServerConfigured": true`.
2. **Client BYOK Key Rotation**:
   - Open MindWeave **BYOK Settings** (key icon in header) → click **Clear Saved Key** (deletes `mindweave_byok_config` from `localStorage`) → enter the new key → test readiness/weave.

---

## 5. 12-Layer Status & Revisit Triggers

Mirrored from `findings.md` (Tier T0 Local-First Flagship Workspace):

| Layer | Current Status | Revisit Trigger |
|---|---|---|
| 1. Frontend (`Next.js 16`, `React 19`, `@xyflow/react`, `elkjs`, `KaTeX`) | Required | Revisit if WebGL rendering for >10,000 nodes is required |
| 2. APIs & Backend (`Route Handlers`, `Zod`, `pdf-parse`, Multi-Provider Gateway) | Required | Revisit if async batch jobs exceed 60s request timeout |
| 3. Database & Storage (`IndexedDB` + `localStorage` fallback) | Required (Local-First) | Revisit for T1 Postgres/Supabase cloud sync or shared team workspaces |
| 4. Auth & Permissions (Local ownership + client BYOK) | Lite | Revisit when T1 cloud database persistence requires user login / sessions |
| 5. Hosting & Deployment (Local Node.js / Git-connected Vercel & Docker) | Lite | Revisit upon public multi-tenant SaaS launch |
| 6. Cloud & Compute (Stateless Node.js runtime) | Deferred | Revisit when scanned PDF OCR or >100 concurrent heavy PDF jobs require dedicated worker queues |
| 7. CI/CD & VCS (Git Conventional Commits + `.github/workflows/ci.yml`) | Required | Revisit for multi-developer T2 staging/canary release gates |
| 8. Security & RLS (Zod bounds, YouTube ID regex, 20 MB limit, SSRF guard) | Required | Revisit to add Postgres Row-Level Security (RLS) immediately upon T1 multi-user DB adoption |
| 9. Rate Limiting (`src/lib/rate-limit.ts` in-memory bucket) | Lite | Revisit to move to distributed Upstash Redis / Arcjet when scaling horizontally (>1 instance) |
| 10. Caching & CDN (`IndexedDB` SHA-256 chunks + Next static assets) | Lite | Revisit for distributed Redis & edge CDN tag purging at T1/T2 |
| 11. Load Balancing & Scaling (`healthz/live` & `healthz/ready`) | Deferred | Revisit when sustained traffic >50 req/sec requires connection pooling & autoscaling |
| 12. Error Tracking & Logs (`src/lib/logger.ts` redacted JSON logs) | Lite | Revisit to integrate Sentry/Datadog SDK & read-only MCP at T1 public launch |
