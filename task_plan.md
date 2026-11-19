# MindWeave — S.C.O.P.E. Task Plan (Macro Blueprint)

## Phase 0: Initialization (Mandatory Setup) — COMPLETE
- [x] **Project Memory**: Initialize `task_plan.md`, `findings.md`, and `progress.md`
- [x] **Law Documents**: Initialize `architecture/schemas.md`, `architecture/decisions.md`, and `architecture/maintenance.md`
- [x] **Constitution**: Copy `AGENTS.template.md` to `AGENTS.md` (no YAML frontmatter)
- [x] **Hygiene**: Run `git init`, create `.gitignore` (excluding `.env*`, `.tmp/`, `node_modules/`, `.worktrees/`, `.taste-skill/`), and create `.env.example` (keys only, zero secrets)
- [x] **Tooling Verification**: Inventory installed vs. missing S.C.O.P.E. skills and MCP tools in `findings.md`
- [x] **Hard Halt**: Confirm zero application code exists in `src/` or `tools/` prior to Gate 1 approval

---

## Phase 1: S — Specification (Vision, Schemas, UI Direction & Gate 1) — COMPLETE
Skills Loaded: `scope`, `design-taste-frontend` (`start.mjs` & `deal.mjs` executed), `impeccable` (`init.md`, `new-work.md`, `operate.md`, `craft-floor.md`, `document.md`), `tokens-bd-api`

- [x] Resolve missing UI/core skill installation (`impeccable`, `verification-before-completion`, `systematic-debugging`, `web-design-guidelines`, `vercel-react-best-practices`)
- [x] Complete structured discovery (Full 10-feature Flagship Suite, Tier T0 Local-First Workspace, Hybrid `.env` + In-App BYOK AI Gateway)
- [x] Finalize 12-Layer Decision Table & Security Threat Sketch in `findings.md`
- [x] Define full TypeScript/Zod domain schemas, AI BYOK header contract, REST API contracts, error envelope, and permissions matrix in `architecture/schemas.md`
- [x] Author `PRODUCT.md` (`impeccable` schema v1), `DESIGN.md` (with dealt `swap-pastels` / `blue-black-cornflower` tokens + `Schibsted Grotesk` / `JetBrains Mono`), and `.impeccable/design.json`
- [x] Update `AGENTS.md` Project Facts and confirm zero files exist in `src/` or `tools/`
- [x] **Gate 1 Approval (Hard Stop)**: User approved Macro Blueprint, `PRODUCT.md`, `DESIGN.md`, `architecture/schemas.md`, and 12-Layer Decision Table

---

## Phase 2: C — Connections (Connectivity & Credentials) — COMPLETE
Skills & References Loaded: `scope/references/config-templates.md`, `tokens-bd-api`

- [x] Configure `.agents/hooks.json`, `.agents/mcp_config.json` (keyless), and `.agents/rules/ui-components.md` (valid `trigger: glob` frontmatter)
- [x] Verify `.gitignore` & `.env.example` secret hygiene
- [x] Initialize `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `vitest.config.ts`, and install locked stack dependencies
- [x] Build and run `tools/verify-connections.mjs` to verify `ELK.js` layout engine, `pdf-parse`, `KaTeX`, `Zod` schemas, secret redaction, and multi-provider AI gateway / BYOK resolution
- [x] Verify `npx tsc --noEmit` passes with zero errors
- [x] Record handshake proof in `progress.md` and stop at **Phase 2 Checkpoint**

---

## Phase 3: O — Organization (The 3-Layer Build) — COMPLETE
Skills & References Loaded: `scope/references/stack-matrix.md`, `scope/references/caching-and-scaling.md`, `vercel-react-best-practices`, `systematic-debugging`, `verification-before-completion`, `design-taste-frontend`, `impeccable`

- [x] **Slice 1**: Core Domain Zod Contracts, Structured Logger, Rate Limiter & Multi-Provider AI Gateway (`5` files in `src/`, SOP `architecture/security-and-ai.md`, tests)
- [x] **Slice 2**: Multi-Source Ingestion Engine, Flagship Demo Dataset & Health/Weave APIs (`5` files in `src/`, SOP `architecture/ingestion-and-synthesis.md`, tests)
- [x] **Slice 3**: Cognitive Graph APIs — Expand, Node Lenses, Blind Spots, Study Grader & Grounded Chat (`5` files in `src/`, SOP `architecture/cognitive-apis.md`, tests)
- [x] **Slice 4**: Local-First Storage (`IndexedDB`), 4-Mode Spatial Engine (`ELK.js`), Bi-Directional Markdown/Mermaid Sync & Multi-Format Exporters (`5` files in `src/`, SOP `architecture/spatial-and-storage.md`, tests)
- [x] **Slice 5**: Design System Tokens (`globals.css`), Root Layout, BYOK Settings Modal, Multi-Source Tray & Studio Launchpad (`5` files in `src/`, SOP `architecture/ui-architecture.md`)
- [x] **Slice 6**: Spatial Canvas Studio, 4-Quadrant Node Card, KaTeX/Code/Mermaid Renderer, Semantic Cross-Edge & Studio Header (`5` files in `src/`)
- [x] **Slice 7**: Left Source/Outline/Sync Drawer, Right Cognitive/Feynman Dock, Walkthrough HUD, Main Page (`4` files in `src/`) & Integration Tests
- [x] **Live Browser Verification (`/browser`) & Phase 3 Checkpoint (Hard Stop)**

---

## Phase 4: P — Polish (Refinement, UI, Accessibility & Performance) — COMPLETE
Skills Loaded: `impeccable` (`polish.md`, `audit.md`, `craft-floor.md`), `design-taste-frontend`, `web-design-guidelines`, `vercel-react-best-practices`

- [x] Configure ESLint v9 flat config (`eslint.config.mjs`) and verify `npm run lint` passes with 0 errors
- [x] Apply `impeccable` craft-floor & audit fixes in `src/app/globals.css` (intentional `prefers-reduced-motion` preserving state feedback, `tabular-nums` on monospace metrics)
- [x] Add Fatal Error boundary (`src/app/error.tsx`) completing all 5 UI states (Loading, Empty, Success, Partial Error, Fatal Error) with offline JSON backup recovery
- [x] Apply `vercel-react-best-practices` (`bundle-dynamic-imports`) in `src/app/page.tsx` via `next/dynamic` for `SpatialCanvas` with drafting skeleton
- [x] Polish responsive mobile drawers (`< 1024px` auto-collapse & single-drawer exclusivity) in `src/store/workspace-store.ts`, WCAG SC 2.5.8 target spacing in `src/components/canvas/MindMapNodeCard.tsx`, and mobile/desktop Studio HUD & toast non-overlap (`SpatialCanvas.tsx`, `WalkthroughAndStudyBar.tsx`, `src/app/page.tsx`)
- [x] Verify client bundle secret scan, `typecheck`, `lint`, `test`, `build`, and live `/browser` check across desktop & mobile
- [x] Record 5-Dimension Impeccable Audit Health Score in `progress.md` and stop at **Phase 4 Checkpoint**

---

## Phase 5: E — Execution (Deployment, CI/CD & Production Gate) — PLACEHOLDER
*(Detailed release & rollback plan authored at Phase 5 entry after reading `references/caching-and-scaling.md`, `references/skills-and-safety.md`, and GitHub Actions CI setup.)*
- Satisfy Production Readiness Gate (**Gate 2**) with verified terminal & `/browser` smoke test proof
- Finalize `architecture/maintenance.md` and run `/learn`
