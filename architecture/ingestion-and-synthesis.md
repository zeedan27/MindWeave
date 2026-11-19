# SOP: Multi-Source Ingestion & Knowledge Synthesis

## 1. Supported Sources & Limits
- Maximum **5 heterogeneous sources** per `/api/weave` request (`topic`, `youtube`, `pdf`, `text`).
- Uploaded files accept `.pdf`, `.txt`, and `.md` only, capped at **20 MB** (`20 * 1024 * 1024` bytes) per file.
- YouTube inputs must pass `extractYouTubeId()` matching `^[a-zA-Z0-9_-]{11}$` (strict allowlist; never fetches arbitrary URLs).

## 2. Segment Normalization & Caching Hash
- Every ingested source produces a `SourceDocument` with SHA-256 `rawTextHash` and indexed `SourceSegment[]`:
  - **PDF:** Parsed via `pdf-parse` v2 (`PDFParse`), preserving exact `pageNumber` (`page.num`) across paragraphs and destroying the parser cleanly in `finally`.
  - **Text / Markdown:** Split by Markdown headings (`#`, `##`, `###`) and paragraphs with `heading` preserved.
  - **YouTube:** Fetches `https://www.youtube.com/watch?v=${videoId}`, extracts video title, description chapter timestamps (`MM:SS` / `HH:MM:SS`), and timed caption tracks (`captionTracks` XML) into `startSec`/`endSec` segments when available.
  - **Topic Prompt:** Generates a canonical topic segment (`index: 0`).

## 3. Grounded Multi-Source Synthesis & Offline Fallback
- `weaveSourcesToWorkspace()` prompts the active AI provider to synthesize 1–5 `SourceDocument`s into a single tree (`rootNode` + 2–3 levels), attaching `SourceAnchor` references (`segmentId`, `pageNumber` or `timestampSec`, verbatim `excerpt`, and `agreement`: `consensus` | `unique` | `contradiction` when `sources.length >= 2`), initial `CrossLink`s, `BlindSpotInsight`s, and `WalkthroughStep`s.
- **Zero-Key Offline Fallback:** When `isLiveAIConfigured()` is `false`, `buildDeterministicWorkspaceFromSources(sources)` builds a structured, source-anchored `MindMapWorkspace` directly from extracted segments/headings/chapters without blocking the user, and `createFlagshipDemoWorkspace()` provides the rich sample workspace (*"Transformer Architecture & Scaling Laws"*).
