# SOP: Cognitive Graph & Active Learning APIs

## 1. Endpoints & Contracts
All 5 cognitive endpoints enforce Zod request validation (`src/lib/schemas.ts`), sliding-window rate limiting (`30 req/min`), and `Cache-Control: private, no-store`:
- `POST /api/expand`: Expands a node with 3–4 sub-nodes distinct from `siblingTopics` and `ancestorTopics`, attaching matching `SourceAnchor`s when relevant `sourceSegments` exist (using `jsonMode: true` and `rankRelevantSegments()`).
- `POST /api/lens`: Generates one `NodeLensCard` (`eli5`, `critic`, `first_principles`, or `code_math`) with optional syntax-highlighted `codeBlock`, `mathLatex`, and `mermaidDiagram` (using `jsonMode: true` and `rankRelevantSegments()`).
- `POST /api/blindspots`: Inspects `nodesOutline` and `existingCrossLinks` to surface missing perspectives (`BlindSpotInsight[]`) and cross-branch semantic connections (`CrossLink[]`), receiving stratified `sourceSummary` context via `sampleStratifiedSegments()`.
- `POST /api/study/evaluate`: Evaluates `cloze` or `feynman` learner explanations against node concepts (`score` 0–100, `mastery`: `mastered` >= 80, `partial` >= 45, `needs_review` < 45, actionable `feedback`, and `missedConcepts`, using `jsonMode: true` and `rankRelevantSegments()`).
- `POST /api/chat`: Grounded Socratic Q&A returning structured Markdown replies and cited `SourceAnchor[]` via `rankRelevantSegments()`.

## 2. Segment Relevance & Deterministic Zero-Key Fallback Behavior
- Client callers in `src/store/workspace-store.ts` and server handlers rank stored segments (up to `200` per PDF) with `rankRelevantSegments()` (and `sampleStratifiedSegments()` for `/api/blindspots` `sourceSummary`) from `src/lib/ingestion/segment-ranker.ts`, surfacing matching late-paper sections and Markdown tables while de-prioritizing `References`.
- When `isLiveAIConfigured(config)` is `false`, each endpoint returns deterministic, domain-relevant educational artifacts (derived from the node title, summary, child topics, and supplied `sourceSegments`) flagged with `usedFallback: true` so every interactive studio capability remains testable and usable without an external key.
