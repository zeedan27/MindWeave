# SOP: Spatial Layout, Local Persistence, Live Sync & Exports

## 1. Local-First Persistence (`src/lib/storage/workspace-db.ts`)
- Primary store: Browser `IndexedDB` (`mindweave_db`, object store `workspaces`, keyed by `id`).
- Transparent fallback: `localStorage` (`mindweave_workspaces_v1`) when `indexedDB` is unavailable or denied.
- BYOK credentials live strictly client-side under `localStorage` key `mindweave_byok_config_v1` and serialize to `x-mindweave-ai-config` (Base64-UTF8 JSON).
- URL-hash snapshots use `#mw=<base64url>` validated through `MindMapWorkspaceSchema.safeParse()` before hydration.

## 2. 4-Mode ELK.js Spatial Layout & Directional Handles (`src/lib/layout/spatial-engine.ts`)
- Supports `balanced` (alternating left/right layered halves around root), `logic_tree` (left-to-right `elk.layered`), `radial` (`elk.radial` with guaranteed collision padding), and `flowchart` (top-to-bottom `elk.layered`).
- **Directional Quadrant Handle Selection:** Computes center-to-center `(dx, dy)` between every edge's source and target nodes to select `sourceHandle` (`source-top | source-right | source-bottom | source-left`) and `targetHandle` (`target-top | target-right | target-bottom | target-left`) so edges never intersect node cards.
- Emits both structural hierarchy edges and dashed semantic `CrossLink` edges.

## 3. Bi-Directional Markdown & Mermaid Sync (`src/lib/sync/markdown-mermaid.ts`)
- `workspaceToMarkdown()` and `markdownToRootNode()` synchronize `#`/`##` headings and indented bullet hierarchies while preserving existing node IDs, `anchors`, `lenses`, and `mastery` state matched by normalized topic.
- `workspaceToMermaid()` and `mermaidToRootNode()` synchronize `flowchart LR` definitions and `-->` edges while preserving cross-links and node metadata.

## 4. Client-Side Multi-Format Exporters (`src/lib/export/exporters.ts`)
- **SVG Vector:** Deterministic standalone SVG document with wrapped labels, citation tags, semantic colors, and cubic Bezier paths.
- **4x Retina PNG:** Rasterizes the exported SVG onto an offscreen HTML `<canvas>` scaled `4x`.
- **Obsidian Canvas (`.canvas`):** JSON Canvas 1.0 schema (`nodes[]` + `edges[]`) with color mapping.
- **Anki Flashcard Deck (`.csv`):** Escaped CSV rows pairing hierarchical topic paths with summaries, citations, and applied lenses.
