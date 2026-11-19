# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

delegated: Next.js 16 (App Router, React 19, TypeScript), Tailwind CSS v4, `@xyflow/react` v12, `elkjs`, Zustand, Zod, `pdf-parse`, `katex`, `react-markdown`, `mermaid` (strict mode), Vitest, and a unified multi-provider AI gateway (OpenAI, Groq, Google Gemini, Anthropic, Tokens.bd, Ollama) — chosen for interactive multi-layout spatial graph performance, deterministic boundary validation, and zero-login T0 local-first persistence via browser `IndexedDB`.

## Users

Students, academic researchers, engineers, and lifelong learners synthesizing dense technical papers, long YouTube lectures, and complex multidisciplinary topics. They are actively reading, cross-referencing multiple sources, structuring mental models, and testing retention under time pressure.

## Product Purpose

MindWeave transforms passive inputs (research PDFs, YouTube lectures, markdown notes, or free-form topics) into interactive, source-grounded spatial knowledge maps. Success means a learner can trace every concept back to its exact page quote or video timestamp, inspect blind spots and cross-branch relationships, test their memory directly on the canvas, and export durable knowledge artifacts.

## Positioning

Unlike single-input auto-summarizers that generate disconnected, hallucination-prone trees on dead canvases, MindWeave weaves **multiple heterogeneous sources** into one grounded spatial studio where every node carries verifiable page/timestamp anchors, multi-layout switching (`Balanced`, `Logic Tree`, `Radial`, `Flowchart`), one-click cognitive lenses (ELI5, Critic, First-Principles, Code/Math), topology-based Blind Spot detection, Active Recall & Feynman grading directly on the map, and live bi-directional Markdown/Mermaid sync.

## Operating Context

- Desktop and tablet research/study sessions (with responsive mobile canvas fallback).
- Users alternate between **Studio Launchpad** (composing multi-source inputs or opening saved local workspaces) and **Spatial Canvas Studio** (inspecting source excerpts, jumping YouTube timestamps, running Recall/Feynman study drills, editing Markdown/Mermaid outlines, and exporting SVG/PNG/Obsidian/Anki files).
- Supports zero-cost offline exploration via a built-in Interactive Demo Workspace alongside Hybrid `.env` + client BYOK API key configuration.

## Capabilities and Constraints

- **Inputs:** Multi-source weaving (1–5 combined sources per map: free-text topic, `.pdf`/`.txt`/`.md` uploads up to 20 MB each, validated YouTube video URLs).
- **Spatial Layouts:** Collision-free `ELK.js` / hierarchical layout engine supporting `Balanced`, `Logic Tree`, `Radial`, and `Flowchart` modes with directional 4-side node handles.
- **Knowledge & Learning Loops:** Contextual Node Lenses, semantic cross-links, AI Blind Spot detector, Active Recall Cloze Mode, Feynman Explain-It-Back grader, Guided Walkthrough camera tour, and bi-directional Markdown/Mermaid sync.
- **Portability:** Real client-side `SVG`, `4x PNG`, `Markdown`, `Obsidian .canvas`, `Anki .csv`, `.mindweave.json`, and compressed URL-hash sharing.
- **Constraints:** Tier T0 Local-First (`IndexedDB` + `localStorage` fallback); no server-side user accounts or cloud DB in v1.0; YouTube extraction strictly validates 11-character video IDs; client BYOK keys never leave the user's browser except over HTTPS/localhost request headers to the user's own API route and are never logged or persisted server-side.

## Brand Commitments

- **Name:** MindWeave
- **Voice:** Plain, architectural, and intellectually honest—no hype, no generic AI buzzwords, clear error causes and recovery paths.
- **Core Rule:** Ground claims in supplied sources whenever sources exist, and distinguish consensus, unique detail, and contradiction transparently.

## Evidence on Hand

- Prior legacy Z.ai implementation audited and removed due to broken edge routing, template bloat, and unimplemented export/share stubs (`ADR-001`).
- No fabricated customer testimonials, team counts, or usage metrics may appear anywhere in the interface; when displaying the zero-key Interactive Demo Workspace, label it explicitly as an interactive sample dataset.

## Product Principles

1. **Verifiable Grounding Over Black-Box Summaries:** Every extracted concept points back to a real page quote or video timestamp when sourced from documents or video.
2. **Spatial Clarity Over Visual Noise:** Layout math guarantees zero overlapping cards and directional edge routing before visual styling is applied.
3. **Active Synthesis Over Passive Reading:** A map is a study instrument—built for testing recall, questioning blind spots, and explaining ideas back.
4. **Local Sovereignty & Portability:** User maps, source hashes, and study progress belong to the user's browser and export cleanly to open formats.

## Accessibility & Inclusion

- Target **WCAG 2.1 AA** contrast across light and dark drafting surfaces.
- Full keyboard navigation across canvas controls, outline tree parity for screen readers (every spatial map has an accessible hierarchical outline twin), visible `:focus-visible` outlines, semantic landmarks, explicit form labels, and full `prefers-reduced-motion` support disabling pan/zoom animations.
