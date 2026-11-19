# MindWeave — Architecture Decision Records (ADR Log)

## ADR-001: Clean-Room Rebuild under S.C.O.P.E. Framework
- **Date:** 2026-11-20
- **Status:** Accepted
- **Context:** The prior MindWeave implementation (scaffolded from a Z.ai boilerplate) suffered from broken radial edge routing (`Position.Top`/`Position.Bottom` only handles), heavy unused template bloat (40+ unused UI components, dead Prisma `User`/`Post` schema, dead `Header.tsx`), and non-functional placeholder actions (fake PNG export toast, empty Share handler, hardcoded YouTube loading copy).
- **Decision:** Delete all prior project files completely and re-initialize `d:\Projects\MindWeave` cleanly under the S.C.O.P.E. framework (`Phase 0 → 5`) with data-first schemas (`architecture/schemas.md`), skill-driven UI tokens (`DESIGN.md`), and deterministic vertical slices (`<= 5` code files per slice).
- **Consequences:** All legacy technical debt is eliminated. No code in `src/` or `tools/` will be written until Gate 1 passes.

## ADR-002: Vetted S.C.O.P.E. Core & UI Skills Installation
- **Date:** 2026-11-20
- **Status:** Accepted
- **Context:** Phase 0 tooling verification identified 5 missing S.C.O.P.E.-recommended skills required across Phases 1, 3, 4, and 5 (`impeccable`, `verification-before-completion`, `systematic-debugging`, `web-design-guidelines`, `vercel-react-best-practices`). User explicitly approved installing the required skills.
- **Decision:** Installed all 5 skills globally via `npx -y skills add ... -g -y` into `C:\Users\Zeedan\.gemini\config\skills\` and `C:\Users\Zeedan\.agents\skills\`:
  - `pbakaus/impeccable` (`impeccable` v4.10.0) — Note: Snyk scanner flagged `Critical Risk` due to its optional self-contained launcher binary mechanism; `SKILL.md` provides a fallback direct-read mode if the launcher is unavailable, and all prompt/reference files are from the official `pbakaus/impeccable` repository listed in `scope/references/skills-and-safety.md`.
  - `obra/superpowers` (`verification-before-completion`, `systematic-debugging`)
  - `vercel-labs/agent-skills` (`web-design-guidelines`, `vercel-react-best-practices`)
- **Consequences:** Total active S.C.O.P.E. core/UI skills stand at 7 (within the `<= 8` core, `~12` total cap). Phase 1 Specification (`PRODUCT.md` and `DESIGN.md`) can now proceed cleanly using both `design-taste-frontend` and `impeccable` once Discovery answers are collected.
