# MindWeave — Architecture Schemas & Contracts

> **Status:** Locked Specification (Phase 1 — Pending Gate 1 User Approval). Every TypeScript type, Zod boundary validator, API contract, error envelope, and permissions boundary in `src/` must derive from this document.

---

## 1. Core Domain Entities & Zod Contracts

### 1.1 Sources & Grounded Segments
```ts
export type SourceType = 'topic' | 'pdf' | 'text' | 'youtube';

export interface SourceSegment {
  id: string;            // Deterministic: `${sourceId}-seg-${index}`
  sourceId: string;
  index: number;
  text: string;
  pageNumber?: number;   // PDFs
  startSec?: number;     // YouTube transcripts
  endSec?: number;       // YouTube transcripts
  heading?: string;      // Markdown / document section title
}

export interface SourceDocument {
  id: string;
  type: SourceType;
  title: string;
  originLabel: string;   // e.g. filename, YouTube channel + title, or topic prompt
  url?: string;          // Validated YouTube watch URL (no arbitrary URLs)
  fileName?: string;
  rawTextHash: string;   // SHA-256 hex digest for deduplication & caching
  segments: SourceSegment[];
  createdAt: number;
}
```

### 1.2 Source Anchors, Lenses, & Study Mastery
```ts
export type AgreementStatus = 'consensus' | 'unique' | 'contradiction';

export interface SourceAnchor {
  sourceId: string;
  segmentId?: string;
  sourceType: SourceType;
  label: string;         // e.g. "Page 4 · Sec 2.1" or "▶ 04:12"
  excerpt: string;       // Verbatim short quote from SourceSegment
  pageNumber?: number;
  timestampSec?: number;
  agreement?: AgreementStatus;
}

export type NodeLensType = 'eli5' | 'critic' | 'first_principles' | 'code_math';

export interface NodeLensCard {
  id: string;
  type: NodeLensType;
  title: string;
  summary: string;
  codeBlock?: {
    language: string;
    code: string;
  };
  mathLatex?: string;
  mermaidDiagram?: string;
  createdAt: number;
}

export type NodeMasteryState = 'untested' | 'mastered' | 'partial' | 'needs_review';
```

### 1.3 Spatial Graph Nodes, Cross-Links, Blind Spots & Walkthrough
```ts
export interface MindMapNode {
  id: string;            // Stable path or nanoid (e.g. "root", "n_01", ...)
  parentId: string | null;
  topic: string;         // 2-7 words, scannable heading
  summary: string;       // 1-2 sentences visible on canvas / inspector
  detailedNotes?: string;
  level: number;         // 0 = root, 1 = primary branch, 2+ = sub-branches
  children: MindMapNode[];
  anchors: SourceAnchor[];
  lenses: NodeLensCard[];
  mastery: NodeMasteryState;
  masteryScore?: number; // 0-100 from Active Recall or Feynman Challenge
  masteryFeedback?: string;
  isCollapsed?: boolean;
  isClozeMasked?: boolean;
}

export type LayoutMode = 'balanced' | 'logic_tree' | 'radial' | 'flowchart';

export type CrossLinkRelation =
  | 'causes'
  | 'contradicts'
  | 'depends_on'
  | 'supports'
  | 'bridges';

export interface CrossLink {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  relation: CrossLinkRelation;
  label: string;         // Concise 1-3 word edge badge
  rationale: string;
  isAiSuggested?: boolean;
}

export interface BlindSpotInsight {
  id: string;
  title: string;
  missingPerspective: string;
  whyItMatters: string;
  suggestedParentNodeId: string;
  suggestedTopic: string;
  suggestedSummary: string;
  resolved: boolean;
}

export interface WalkthroughStep {
  stepIndex: number;
  nodeId: string;
  headline: string;
  narrative: string;
  durationSec: number;
}
```

### 1.4 Contextual Chat & Workspace Root
```ts
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  mode: 'ask' | 'feynman';
  content: string;
  nodeId?: string;
  nodeTopic?: string;
  citations?: SourceAnchor[];
  feynmanEvaluation?: {
    score: number;
    mastery: NodeMasteryState;
    missedConcepts: string[];
  };
  timestamp: number;
}

export interface MindMapWorkspace {
  id: string;
  schemaVersion: 1;
  title: string;
  subtitle: string;
  layoutMode: LayoutMode;
  sources: SourceDocument[];
  rootNode: MindMapNode;
  crossLinks: CrossLink[];
  blindSpots: BlindSpotInsight[];
  walkthrough: WalkthroughStep[];
  chatMessages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}
```

---

## 2. AI Provider & BYOK Header Contract

### 2.1 Supported Providers
`AIProviderId`: `'openai' | 'groq' | 'google' | 'anthropic' | 'tokens_bd' | 'ollama'`

| Provider ID | Default Base URL | Default Model | Protocol |
|---|---|---|---|
| `openai` | `https://api.openai.com/v1` | `gpt-4o-mini` | OpenAI SDK |
| `groq` | `https://api.groq.com/openai/v1` | `llama-3.3-70b-versatile` | OpenAI-compatible SDK |
| `google` | Native SDK | `gemini-2.0-flash` | `@google/generative-ai` |
| `anthropic` | `https://api.anthropic.com/v1` | `claude-3-5-haiku-20241022` | Anthropic headers (`anthropic-version`) |
| `tokens_bd` | `https://tokens.bd/v1` | `deepseek-ai/deepseek-v4.1-flash-1017` | OpenAI-compatible (`Authorization: Bearer $KEY`) or Anthropic (`https://tokens.bd`, `x-api-key`) |
| `ollama` | `http://localhost:11434/v1` | `llama3.2` | Local OpenAI-compatible |

### 2.2 Resolution & Security Order
1. Client optionally passes `x-mindweave-ai-config` HTTP header containing Base64-encoded UTF-8 JSON validated against:
   ```ts
   z.object({
     provider: z.enum(['openai', 'groq', 'google', 'anthropic', 'tokens_bd', 'ollama']),
     apiKey: z.string().max(512).optional(),
     baseUrl: z.string().url().optional(),
     model: z.string().max(128).optional(),
   })
   ```
   *(SSRF rule: custom `baseUrl` is restricted to `https://` or explicit local loopback `http://localhost` / `http://127.0.0.1` for Ollama).*
2. If header is omitted or has no `apiKey` (except `ollama`), server falls back to `.env` (`AI_PROVIDER`, `AI_API_KEY`, `AI_BASE_URL`, `AI_MODEL`).
3. If neither has a valid key, AI endpoints return `401` (`AI_KEY_MISSING`), and the UI cleanly offers either opening the **BYOK Settings Modal** or loading the **Interactive Demo Flagship Workspace** (zero-key deterministic showcase).
4. **Secret Hygiene:** `x-mindweave-ai-config` and `apiKey` values are held strictly in request-scoped memory and stripped (`[REDACTED]`) before any structured logging.

---

## 3. REST API Endpoint Contracts

### Standard Success & Error Envelopes
All routes return a deterministic envelope with `x-request-id`:
```ts
// Success
{ ok: true, data: T, requestId: string }

// Error
{
  ok: false,
  error: {
    code:
      | 'VALIDATION_ERROR'
      | 'AI_KEY_MISSING'
      | 'AI_UPSTREAM_ERROR'
      | 'AI_SCHEMA_INVALID'
      | 'SOURCE_EXTRACTION_FAILED'
      | 'FILE_TOO_LARGE'
      | 'UNSUPPORTED_FILE_TYPE'
      | 'RATE_LIMITED'
      | 'INTERNAL_ERROR',
    message: string,
    requestId: string,
    details?: Record<string, unknown>,
    retryAfterSec?: number
  }
}
```

### 3.1 `POST /api/weave`
- **Purpose:** Ingest 1 to 5 heterogeneous sources (topics, markdown/text notes, PDF uploads up to 20 MB, YouTube URLs) and synthesize one unified `MindMapWorkspace` with `SourceAnchor`s, multi-source `AgreementStatus` tags, initial `CrossLink`s, and `WalkthroughStep`s.
- **Request:** `multipart/form-data` (`sourcesMeta`: JSON array of topic/youtube/text entries + `files`: uploaded `.pdf`/`.txt`/`.md` files) OR `application/json` (`{ sources: Array<{ type: 'topic' | 'youtube' | 'text', title?: string, content: string }> }`).
- **Response (`200`):** `{ ok: true, data: { workspace: MindMapWorkspace }, requestId }`

### 3.2 `POST /api/expand`
- **Purpose:** Expand a target node with 3–5 deeper, non-duplicate child nodes anchored to existing source segments where available.
- **Request JSON:** `{ workspaceTitle: string, node: { id: string, topic: string, summary: string }, siblingTopics: string[], ancestorTopics: string[], sourceSegments?: SourceSegment[] }`
- **Response (`200`):** `{ ok: true, data: { children: MindMapNode[], newCrossLinks: CrossLink[] }, requestId }`

### 3.3 `POST /api/lens`
- **Purpose:** Transform or enrich a node using one of four contextual lenses (`eli5`, `critic`, `first_principles`, `code_math`).
- **Request JSON:** `{ workspaceTitle: string, node: { id: string, topic: string, summary: string }, lensType: NodeLensType, sourceSegments?: SourceSegment[] }`
- **Response (`200`):** `{ ok: true, data: { lensCard: NodeLensCard }, requestId }`

### 3.4 `POST /api/blindspots`
- **Purpose:** Analyze the full graph outline and source segments to detect structural gaps, missing counter-arguments, and cross-branch semantic connections.
- **Request JSON:** `{ workspaceTitle: string, nodesOutline: Array<{ id: string, parentId: string | null, topic: string, summary: string }>, existingCrossLinks: CrossLink[], sourceSummary?: string }`
- **Response (`200`):** `{ ok: true, data: { blindSpots: BlindSpotInsight[], suggestedCrossLinks: CrossLink[] }, requestId }`

### 3.5 `POST /api/study/evaluate`
- **Purpose:** Grade a learner's Active Recall cloze submission or Feynman "Explain It Back" attempt against the target node and its grounded source segments.
- **Request JSON:** `{ mode: 'cloze' | 'feynman', node: { id: string, topic: string, summary: string, childrenTopics: string[] }, userAnswer: string, sourceSegments?: SourceSegment[] }`
- **Response (`200`):** `{ ok: true, data: { score: number, mastery: NodeMasteryState, feedback: string, missedConcepts: string[] }, requestId }`

### 3.6 `POST /api/chat`
- **Purpose:** Grounded Socratic Q&A aware of the active map, selected node, and matching source segments.
- **Request JSON:** `{ message: string, history: Array<{ role: 'user' | 'assistant', content: string }>, workspaceTitle: string, nodesOutline: Array<{ id: string, topic: string, summary: string }>, selectedNode?: { id: string, topic: string, summary: string, childrenTopics: string[] }, sourceSegments?: SourceSegment[] }`
- **Response (`200`):** `{ ok: true, data: { reply: string, citations: SourceAnchor[] }, requestId }`

### 3.7 Health & Readiness Endpoints
- `GET /api/healthz/live` → `{ ok: true, status: 'live', uptimeSec: number }` (`200`)
- `GET /api/healthz/ready` → `{ ok: true, status: 'ready', aiServerConfigured: boolean, provider: string | null }` (`200`)

---

## 4. Roles & Permissions Matrix (Tier T0 Local-First)

| Actor | Capabilities | Boundary / Security Rules |
|---|---|---|
| **Local Browser User (Unauthenticated T0)** | Full CRUD on local workspaces stored in `IndexedDB` / `localStorage`; upload files (`.pdf`/`.txt`/`.md` ≤ 20 MB); configure local BYOK credentials; import/export `.mindweave.json`, `.md`, `.canvas`, `.svg`, `.png`, `.csv`. | Cannot read server `.env`; cannot make arbitrary SSRF requests via server; workspace import validates strictly through Zod before rendering. |
| **Next.js Server Route Handlers** | Parse uploaded files in memory; fetch validated YouTube metadata/transcripts by 11-char ID; call configured LLM gateway; enforce Zod contracts and sliding-window rate limits (`30 req/min`). | Stateless: zero database or filesystem writes for user data or BYOK keys; zero secret logging. |
| **External AI Gateway / Provider** | Receives prompt context + validated source chunks; returns structured text/JSON. | Receives no user PII or workspace identifiers outside the active prompt context. |
