# MindWeave

**AI-Powered Visual Knowledge Mapping & Spatial Learning Workspace**

MindWeave transforms research PDFs, YouTube lectures, Markdown notes, and topics into interactive, source-grounded spatial knowledge maps. Built with Next.js 16 (App Router, React 19, TypeScript), `@xyflow/react`, `elkjs`, and a multi-provider AI gateway, it prioritizes verifiable source grounding, collision-free spatial layouts, and active recall directly on the canvas.

---

## Key Features

1. **Source-Grounded Citations & Timestamps**
   - PDF/text excerpts anchored to exact page numbers and headings in the Sources drawer.
   - YouTube nodes carrying clickable `▶ MM:SS` timestamp pills synced to an embedded player.
2. **Multi-Source Knowledge Synthesis**
   - Combine 1–5 heterogeneous sources (topics, `.pdf` / `.txt` / `.md` uploads up to 20 MB, and YouTube URLs) into one unified map with `consensus`, `unique`, and `contradiction` indicators.
3. **4-Mode Collision-Free Spatial Engine (`ELK.js`)**
   - Switch dynamically between **Balanced**, **Logic Tree**, **Radial**, and **Flowchart** layouts with directional 4-side node handles.
4. **Semantic Cross-Links & Blind-Spot Detector**
   - Visualize cross-branch relationships (`causes`, `contradicts`, `depends_on`, `supports`, `bridges`) and run AI graph-topology gap analysis to surface missing perspectives.
5. **1-Click Contextual Node Lenses**
   - Generate **ELI5 Analogy**, **Critic**, **First-Principles**, and **Code / KaTeX Math / Flow** cards on any node.
6. **Active Recall Cloze Mode & Feynman Grader**
   - Mask child branches into `[ ? ]` recall cards, grade explanations against grounded source segments, and track per-node mastery (`mastered`, `partial`, `needs_review`).
7. **Guided Story Walkthrough**
   - Step-by-step camera tour (`Previous` / `Next` / `Auto-Tour`) across branches with narrative cues.
8. **Bi-Directional Markdown & Mermaid Live Sync**
   - Synchronized outline tree and live Markdown/Mermaid editor.
9. **Local-First Persistence & Multi-Format Export**
   - Zero-login browser persistence via `IndexedDB` (`mindweave_db`) with `localStorage` fallback.
   - Client-side export to **SVG**, **4x PNG**, **Markdown (`.md`)**, **Obsidian Canvas (`.canvas`)**, **Anki Deck (`.csv`)**, **Workspace JSON (`.mindweave.json`)**, and compressed URL-hash sharing.
10. **Built-In Offline Demo & Hybrid BYOK AI Gateway**
    - Explore the built-in **Interactive Flagship Demo Workspace** (*Transformer Architecture & Scaling Laws*) without an API key, or connect your own key via `.env` or the in-app **BYOK Settings** modal.

---

## Tech Stack

- **Frontend:** Next.js 16 (`16.1.1+`), React 19, TypeScript, Tailwind CSS v4, `@xyflow/react`, `elkjs`, `zustand`, `katex`, `react-markdown`, `lucide-react`
- **Backend & Parsing:** Next.js Route Handlers, `zod`, `pdf-parse`, YouTube transcript/metadata extractor, `openai` SDK, `@google/generative-ai`, Anthropic Messages API
- **Testing & Quality:** Vitest, ESLint v9 (`eslint-config-next`), TypeScript (`tsc --noEmit`), GitHub Actions CI ([`.github/workflows/ci.yml`](.github/workflows/ci.yml))

---

## Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure AI Provider (Optional)
MindWeave works offline with the built-in Interactive Flagship Demo Workspace or deterministic fallback extraction. To enable live AI synthesis:

- **Option A — In-App BYOK Modal:** Open **BYOK Settings** (key icon in the header) and enter credentials for **OpenAI**, **Groq**, **Google Gemini**, **Anthropic Claude**, **Tokens.bd Gateway** (`https://tokens.bd/v1`), or **Ollama** (`http://localhost:11434/v1`). Keys are stored locally in browser `localStorage` (`mindweave_byok_config`) and never persisted server-side.
- **Option B — Server `.env`:** Copy [`.env.example`](.env.example) to `.env` and fill in your defaults:
  ```env
  AI_PROVIDER=tokens_bd
  AI_API_KEY=tok_live_your_key_here
  AI_BASE_URL=https://tokens.bd/v1
  AI_MODEL=deepseek-ai/deepseek-v4.1-flash-1017
  ```

### 3. Run Locally
```bash
# Development server (http://localhost:3000)
npm run dev

# Production build & server
npm run build
npm run start
```

---

## Verification & Health Endpoints

```bash
npm run verify:connections   # Verify layout, PDF/KaTeX, schema & AI gateway handshakes
npm run typecheck            # TypeScript check (tsc --noEmit)
npm run lint                 # ESLint check
npm test                     # Vitest unit & API integration suite
npm run build                # Next.js production build
npm run verify:gate2         # Secret scan, runbook, SSRF & health/rate-limit checks
```

- **Liveness Probe:** `GET /api/healthz/live`
- **Readiness Probe:** `GET /api/healthz/ready`

---

## Architecture & Operations Documentation

- [`PRODUCT.md`](PRODUCT.md) — Product brief, positioning, and accessibility commitments
- [`DESIGN.md`](DESIGN.md) — Visual tokens and Architectural Drafting Slate design system
- [`architecture/schemas.md`](architecture/schemas.md) — Domain schemas and API contracts
- [`architecture/decisions.md`](architecture/decisions.md) — Architecture Decision Records (ADRs)
- [`architecture/maintenance.md`](architecture/maintenance.md) — Operations runbook, caching, rollback, secret rotation, and revisit triggers
