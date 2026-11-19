# MindWeave — Research, Constraints & Layer Decisions

## 1. Legacy Codebase Audit Summary (Pre-Wipe Findings)
The previous AI-generated MindWeave implementation (scaffolded from a Z.ai boilerplate) was audited and wiped because of structural and UX defects:
- **Broken Radial Edge Routing**: Nodes placed in a 360° circle around the root hardcoded only `Position.Top` (target) and `Position.Bottom` (source) handles, causing edges to loop through cards and collide on branch expansion.
- **Template Bloat & Dead Code**: Included 40+ unused UI components, an unused Prisma/SQLite `User`/`Post` schema, an unrendered `Header.tsx`, and `.z-ai-config` / `.zscripts` scaffold artifacts.
- **Incomplete / Placeholder Features**:
  - Export button showed a toast instructing the user to take a browser screenshot (`Ctrl+Shift+S`).
  - Share button had a no-op `onClick={() => {}}`.
  - Loading overlay hardcoded YouTube-specific messages (*"Extracting video information"*) even for topic or PDF generation.
  - Root node could not be selected or queried in chat, and descriptions beyond Level 1 were hidden.

---

## 2. Confirmed Discovery Decisions (Phase 1)
1. **Feature Scope (v1.0 Flagship Suite — Phased in Vertical Slices):**
   - **Source-Grounded Citations & Timestamps:** PDF/text segment drawer highlighting exact page/paragraph excerpts; YouTube nodes carrying clickable `▶ MM:SS` timestamp pills jumping an embedded player to transcript segments.
   - **Multi-Source Knowledge Synthesis:** Drop 2+ heterogeneous sources (PDF + YouTube + topic/notes) to weave one unified map color-coded by `consensus`, `unique`, and `contradiction`.
   - **Multi-Layout Spatial Engine (`ELK.js` / D3):** Collision-free switching between Balanced Mind Map, Horizontal Logic Tree, Radial Constellation, and Academic Flowchart with directional quadrant handles (`Top`, `Right`, `Bottom`, `Left`).
   - **Semantic Cross-Links & Blind-Spot Detector:** Dashed cross-branch links (`causes`, `contradicts`, `depends_on`, `supports`, `bridges`) plus an AI graph-topology lens that detects unstated assumptions and missing perspectives.
   - **Contextual Node Lenses (1-Click):** ELI5/Analogy, Counter-Argument/Critic, First-Principles Breakdown, and Code/KaTeX Math/Mermaid Diagram node cards.
   - **Active Recall / Cloze Study Mode:** Mask child branches into `[ ? ]` recall cards, grade semantic answers, and track mastery (`mastered`, `partial`, `needs_review`).
   - **Feynman "Explain It Back" Node Challenge:** Explain any node in plain words inside the study chat; AI evaluates accuracy against grounded source segments and updates a mastery heat-map.
   - **Guided Story / Presentation Walkthrough Mode:** Step-by-step animated viewport pan/zoom tour across branches (`Prev` / `Next`) with concise narrative cues.
   - **Bi-Directional Markdown / Mermaid Live Sync:** Live outline/Mermaid drawer synchronized two-way with the spatial graph.
   - **Real High-Res Exports & Snapshots:** Client-side SVG & 4x PNG export, Markdown & Obsidian Canvas (`.canvas`) export, Anki Flashcard Deck (`.csv`) export, `.mindweave.json` workspace export/import, and compressed URL-hash snapshots.
2. **Project Tier & Persistence:** **T0 Prototype (Local-First Workspace)** — zero-login, browser `IndexedDB` (`mindweave_db`) with `localStorage` fallback plus portable file import/export.
3. **AI Provider & Key Management:** **Hybrid** — server `.env` default plus an in-app **BYOK (Bring Your Own Key) Settings Modal** supporting OpenAI, Groq, Google Gemini, Anthropic, Tokens.bd (`https://tokens.bd/v1` and `https://tokens.bd`), and Ollama / custom OpenAI-compatible endpoints, plus a built-in Interactive Demo mode when no API key is configured.

---

## 3. Phase 0/1 Tooling & Skill Verification Inventory

### Installed & Available Locally
- `scope` (`C:\Users\Zeedan\.gemini\config\skills\scope\SKILL.md`)
- `design-taste-frontend` / `taste-skill` (`C:\Users\Zeedan\.gemini\config\skills\design-taste-frontend\SKILL.md`)
- `impeccable` (`C:\Users\Zeedan\.gemini\config\skills\impeccable\SKILL.md`, also copied to `C:\Users\Zeedan\.agents\skills\impeccable`) — Phase 1, 4
- `verification-before-completion` (`C:\Users\Zeedan\.gemini\config\skills\verification-before-completion\SKILL.md`, also copied to `C:\Users\Zeedan\.agents\skills\verification-before-completion`) — Phase 3 (all slices)
- `systematic-debugging` (`C:\Users\Zeedan\.gemini\config\skills\systematic-debugging\SKILL.md`, also copied to `C:\Users\Zeedan\.agents\skills\systematic-debugging`) — Phase 3, 5 (on errors)
- `web-design-guidelines` (`C:\Users\Zeedan\.gemini\config\skills\web-design-guidelines\SKILL.md`, also copied to `C:\Users\Zeedan\.agents\skills\web-design-guidelines`) — Phase 4
- `vercel-react-best-practices` (`C:\Users\Zeedan\.gemini\config\skills\vercel-react-best-practices\SKILL.md`, also copied to `C:\Users\Zeedan\.agents\skills\vercel-react-best-practices`) — Phase 3, 4
- `tokens-bd-api` (`C:\Users\Zeedan\.gemini\config\skills\tokens-bd-api\SKILL.md`)
- `firecrawl` (`C:\Users\Zeedan\.gemini\config\skills\firecrawl\SKILL.md`)
- `baton-pass` (`C:\Users\Zeedan\.gemini\config\skills\baton-pass\SKILL.md`)

*Skill Count Check:* 7 core/UI S.C.O.P.E. skills + 3 domain/utility skills = 10 skills total, within the S.C.O.P.E. cap (`<= 8` core skills, `~12` total).

---

## 4. Finalized 12-Layer Decision Table (Tier: T0 Local-First Workspace)

| Layer | Status | Selected Tech | Rationale | Revisit Trigger |
|---|---|---|---|---|
| 1 Frontend | Required | Next.js 16 (App Router, React 19, TypeScript), Tailwind CSS v4, `@xyflow/react` v12, `elkjs`, `katex`, `react-markdown`, `lucide-react`, `Schibsted Grotesk` + `JetBrains Mono` | Interactive spatial knowledge studio with 4 layout algorithms, inline math/code/diagrams, and bi-directional Markdown/Mermaid sync | Revisit if WebGL >10,000-node rendering is needed |
| 2 APIs & Backend | Required | Next.js Route Handlers (`/api/weave`, `/api/expand`, `/api/lens`, `/api/blindspots`, `/api/study/evaluate`, `/api/chat`, `/api/healthz/live`, `/api/healthz/ready`), Zod validation, `pdf-parse`, YouTube transcript/metadata extractor, unified multi-provider LLM router | Deterministic JSON schema enforcement with self-healing JSON extraction | Revisit if long-running async batch jobs exceed 60s request timeout |
| 3 Database & Storage | Required (Local-First) | Browser `IndexedDB` (`mindweave_db`) with `localStorage` fallback + `.mindweave.json`, `.md`, `.canvas`, `.csv` file import/export | Zero-friction local privacy and instant responsiveness for T0 | Revisit when multi-device cloud sync or shared team workspaces (T1 Supabase/Postgres) are requested |
| 4 Auth & Permissions | Lite | Local browser workspace ownership + client-side BYOK storage (`localStorage` key `mindweave_byok_config`, never persisted server-side) | Matches T0 zero-login local-first posture while enabling user-controlled API keys | Revisit when T1 cloud database persistence requires user authentication (NextAuth/Supabase Auth) |
| 5 Hosting & Deployment | Lite | Local Node.js dev/prod server & Vercel / standalone Docker preview compatibility | Clean Git-based deployment compatibility following the S.C.O.P.E. Deploy Rule | Revisit upon public multi-tenant SaaS launch |
| 6 Cloud & Compute | Deferred | Standard stateless Node.js runtime | No dedicated GPU or background cluster needed for API-routed LLM inference and `pdf-parse` | Revisit when local OCR of scanned image PDFs or >100 concurrent heavy PDF jobs require dedicated worker queues |
| 7 CI/CD & Version Control | Required (Git + CI Lite) | Git (Conventional Commits), Vitest unit/contract tests, `tsc --noEmit`, `next build`, GitHub Actions CI workflow (`.github/workflows/ci.yml`) | Enforces deterministic verification before every slice commit | Revisit for multi-developer staging/canary pipelines at T2 |
| 8 Security & RLS | Required (Boundary & Secret Hygiene) | Zod request validation, 20 MB file upload limit (`.pdf`, `.txt`, `.md`), YouTube video ID regex allowlist (SSRF prevention), zero server logging of BYOK keys, `.gitignore` secret protection | Prevents XSS, SSRF, secret leakage, and malformed file attacks | Revisit to add Postgres Row-Level Security (RLS) policies immediately upon introducing a T1 multi-user database |
| 9 Rate Limiting | Lite | In-memory IP/session token-bucket rate limiter on `/api/*` AI routes (30 req/min default, HTTP 429 with `Retry-After` header, dry-run configurable) | Guards against accidental client loops draining AI credits | Revisit to switch to distributed Upstash Redis / Arcjet rate limiting when scaling past 1 server instance |
| 10 Caching & CDN | Lite | Client-side SHA-256 content-hash caching of extracted PDF/YouTube source chunks in IndexedDB + deterministic layout memoization | Avoids re-uploading/re-parsing sources during multi-source weaving or layout switches | Revisit to add Redis/CDN edge caching at T1/T2 |
| 11 Load Balancing & Scaling | Deferred | Health & readiness probes (`/api/healthz/live`, `/api/healthz/ready`) | Stateless route handlers scale horizontally when hosted | Revisit when sustained traffic > 50 req/sec requires connection pooling & autoscaling rules |
| 12 Error Tracking & Logs | Lite | Structured JSON logger (`src/lib/logger.ts`) with `x-request-id` correlation and automatic secret/header redaction + `progress.md` test logs | Actionable diagnostics without external telemetry vendor lock-in for T0 | Revisit to connect Sentry/Datadog read-only MCP & SDK upon T1 public launch |

---

## 5. Security & Threat Sketch
Even as a T0 local-first application, MindWeave handles untrusted files, external URLs, LLM-generated content, and user API keys:

| Critical Asset | Threat Vector | Deterministic Mitigation |
|---|---|---|
| **BYOK & Server AI API Keys** | Accidental leakage in browser bundles, error responses, structured logs, or git commits | Server keys live solely in `.env` (gitignored). Client BYOK configs travel over `x-mindweave-ai-config` only to the user's own Next.js server route in memory, are scrubbed by the logger (`[REDACTED]`), and are never echoed back in responses or stored server-side. |
| **YouTube Ingestion Route** | SSRF or arbitrary external URL probing via `/api/weave` | Strict 11-character YouTube video ID allowlist regex (`^[a-zA-Z0-9_-]{11}$`); server only queries official YouTube video/transcript endpoints by validated `videoId`, never fetching arbitrary user-supplied URLs. |
| **PDF & Text Uploads** | Memory exhaustion, zip/object bombs, or unsupported executable uploads | Enforce extension + MIME validation (`.pdf`, `.txt`, `.md`), strict 20 MB per-file and 45,000-char prompt-slice ceiling, and safe server-side `pdf-parse` parsing in `try/catch` returning typed `400`/`422` errors. |
| **LLM-Generated Markdown / Code / Mermaid** | Stored/reflected XSS via `<script>` or malicious `javascript:` links in AI responses or imported `.mindweave.json` | Render Markdown strictly through `react-markdown` without raw HTML (`skipHtml` / no `rehype-raw`), validate Mermaid syntax safely inside sandboxed SVG (`securityLevel: 'strict'`), and validate all imported workspace JSON files via Zod before hydration. |
| **Malformed LLM JSON Outputs** | Runtime crashes when an upstream model wraps JSON in prose or drops required fields | Use a deterministic JSON extractor + Zod repair/validation layer (`src/lib/ai/json-guard.ts`) that strips markdown fences, enforces schema defaults, and returns structured `AI_SCHEMA_INVALID` errors on failure. |
| **Public `/api/*` Credit Drain** | Accidental client retry storms exhausting Groq/OpenAI/Tokens.bd wallet | Sliding-window in-memory token bucket rate limiter (`30 req/min` per IP) returning HTTP `429` with `Retry-After` header, plus `AbortController` cancellation on client requests. |
