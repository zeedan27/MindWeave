---
name: MindWeave
description: Architectural Drafting Studio for source-grounded spatial knowledge mapping and active recall.
colors:
  primary: "#0f5257"
  primary-ink: "#ffffff"
  primary-soft: "#d9ecef"
  studio-putty: "#c3d7e5"
  panel-slate: "#d0e0eb"
  drafting-paper: "#edf3f7"
  elevated-card: "#ffffff"
  carbon-ink: "#141414"
  tinted-slate: "#3f4756"
  border-hairline: "#aec3d2"
  dark-canvas: "#0a0d14"
  dark-panel: "#131824"
  dark-ink: "#e9edf3"
  dark-accent: "#5ab9fc"
  consensus-emerald: "#156f4c"
  unique-ochre: "#b45309"
  contradiction-crimson: "#b91c1c"
  citation-cobalt: "#1d4ed8"
typography:
  display:
    fontFamily: "Schibsted Grotesk, system-ui, sans-serif"
    fontSize: "4rem"
    fontWeight: 500
    lineHeight: 1.04
    letterSpacing: "-0.04em"
  headline:
    fontFamily: "Schibsted Grotesk, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Schibsted Grotesk, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: "-0.015em"
  body:
    fontFamily: "Schibsted Grotesk, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "0em"
  label:
    fontFamily: "JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "0.02em"
rounded:
  sm: "6px"
  md: "8px"
  lg: "12px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "40px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-ink}"
    rounded: "{rounded.md}"
    padding: "10px 18px"
    height: "40px"
  button-primary-hover:
    backgroundColor: "#0b3e42"
  button-secondary:
    backgroundColor: "{colors.elevated-card}"
    textColor: "{colors.carbon-ink}"
    rounded: "{rounded.md}"
    padding: "10px 16px"
    height: "40px"
  card-node:
    backgroundColor: "{colors.elevated-card}"
    textColor: "{colors.carbon-ink}"
    rounded: "{rounded.lg}"
    padding: "14px 16px"
  input-field:
    backgroundColor: "{colors.elevated-card}"
    textColor: "{colors.carbon-ink}"
    rounded: "{rounded.md}"
    padding: "10px 14px"
    height: "42px"
  badge-citation:
    backgroundColor: "#dbeafe"
    textColor: "{colors.citation-cobalt}"
    rounded: "{rounded.sm}"
    padding: "2px 8px"
---

# Design System: MindWeave

## Overview

**Creative North Star: "The Architectural Drafting Studio"**

MindWeave rejects generic dark-neon AI templates and floating purple-glow card grids in favor of a calm, tactile drafting environment inspired by technical notebooks, cartographic atlases, and disciplined editorial workspaces. Cool putty (`#c3d7e5`) and pale drafting paper (`#edf3f7`) establish a glare-free daytime surface where dense concepts remain legible for hours, paired with an optional deep midnight blueprint mode (`#0a0d14`) for low-light focus.

The interface spans two complementary surfaces: a focused **Studio Launchpad** (following `design-taste-frontend` Hero-Collage composition showing the live product window at work alongside a multi-source synthesis tray) and an Operate-mode **Spatial Canvas Studio** where chrome stays quiet so node typography, directional branch paths, and grounded source citations lead.

**Key Characteristics:**
- Dealt cool putty and petrol-teal light palette (`swap-pastels`) paired with `Schibsted Grotesk` + `JetBrains Mono`
- Strict zero-violet/lavender palette across all canvas levels, badges, and interactive controls
- Single-elevation surfaces using crisp `1px solid` borders at rest and directional offset shadow only on focus or hover
- 4-side directional quadrant handles (`Top`, `Right`, `Bottom`, `Left`) guaranteeing edges never route through node cards

## Colors

Colors execute explicit semantic jobs rather than decorative rainbow cycling.

### Primary
- **Deep Petrol Teal** (`#0f5257`): Primary CTA buttons, active navigation states, root concept anchor, and keyboard `:focus-visible` outlines. Soft tint (`#d9ecef`) highlights selected node panels without overpowering text.

### Secondary
- **Citation Cobalt** (`#1d4ed8`): Grounded PDF page references (`Page 4 · Sec 2.1`) and clickable YouTube timestamp badges (`▶ 04:12`).

### Tertiary
- **Consensus Emerald** (`#156f4c`), **Unique Ochre** (`#b45309`), and **Contradiction Crimson** (`#b91c1c`): Reserved exclusively for multi-source synthesis agreement tags, cross-link contradiction edges, Active Recall mastery states (`mastered`, `partial`, `needs_review`), and validation errors.

### Neutral
- **Drafting Paper** (`#edf3f7`) and **Studio Putty** (`#c3d7e5`): Main workspace ground and launchpad canvas frame.
- **Panel Slate** (`#d0e0eb`): Collapsible left Source/Outline drawer and right Inspector/Chat dock.
- **Elevated Card** (`#ffffff`): Crisp surface for spatial mind map nodes, inputs, and modals.
- **Carbon Ink** (`#141414`) & **Tinted Slate** (`#3f4756`): High-contrast primary copy (>= 10:1 on white) and hull-tinted secondary captions (>= 6.5:1).
- **Hairline Border** (`#aec3d2`): Structural 1px dividers separating studio panes and resting cards.
- **Midnight Blueprint (Dark Theme):** Deep canvas `#0a0d14`, panel slate `#131824`, ink `#e9edf3`, and cornflower action accent `#5ab9fc` (`blue-black-cornflower`).

### Named Rules
**The Zero-Violet Rule.** Violet, purple, and lavender hues are banned across accents, canvas nodes, gradients, and badge tints.
**The Semantic Color Job Rule.** Red, amber, green, and cobalt appear strictly to encode contradiction, partial recall/uniqueness, mastery/consensus, or clickable source anchors.
**The Tinted Secondary Ink Rule.** Secondary labels on putty or teal surfaces derive from tinted slate (`#3f4756`) or petrol hue—never pure neutral `#888` gray.

## Typography

**Display Font:** Schibsted Grotesk (with `system-ui, sans-serif` fallback)
**Body Font:** Schibsted Grotesk (with `system-ui, sans-serif` fallback)
**Label/Mono Font:** JetBrains Mono (with `ui-monospace, SFMono-Regular, Menlo, Consolas, monospace` fallback)

**Character:** Sturdy neo-grotesk geometry keeps multi-level node labels crisp down to 12px while `JetBrains Mono` isolates measurable metadata—video timestamps, PDF page numbers, math/code blocks, and shortcut keys—from prose.

### Hierarchy
- **Display** (`500`, `4rem` desktop / `2.5rem` mobile, `1.04` line-height, `-0.04em` tracking): Studio Launchpad H1 only.
- **Headline** (`500`, `1.5rem`, `1.2` line-height): Workspace title bar and empty-state headings.
- **Title** (`600`, `1rem`, `1.35` line-height): Level 0/1 node headings and dock section headers.
- **Body** (`400`, `0.9375rem`, `1.55` line-height, `65-75ch` max measure in prose drawers): Node summaries, AI chat replies, and source excerpts.
- **Label / Mono** (`500`, `0.75rem`, `1.4` line-height): Citation pills (`Page 4`), timestamps (`▶ 04:12`), cross-link edge badges, and shortcut hints.

### Named Rules
**The Fixed Operate Scale Rule.** Inside the Spatial Canvas Studio, typography uses fixed `rem` steps (`1.125-1.2x` ratio) rather than fluid `clamp()` scaling so sidebars and canvas cards remain stable across window splits.
**The Monospace Evidence Rule.** `JetBrains Mono` is reserved strictly for timestamps, page numbers, code blocks, Markdown/Mermaid source text, and tabular metrics—never decorative eyebrows.

## Layout

MindWeave enforces equal left/right viewport margins on the Launchpad (`1440px` max grid, `6/6` Hero-Collage split on desktop stacking text-first at `<= 1024px` and `390px`) and transitions cleanly into a full-height (`100dvh`) **3-Zone Drafting Studio**:
1. **Top Studio Header (`52px`):** Workspace switcher, source-grounded badge strip, Layout Mode segmented picker (`Balanced`, `Logic Tree`, `Radial`, `Flowchart`), Study Mode toggle (`Explore` / `Active Recall` / `Walkthrough`), Export menu, BYOK Settings button, and Theme toggle.
2. **Collapsible Left Drawer (`340px` desktop, slide-over sheet `< 1024px`):** Tabbed **Sources & Excerpts** (clickable PDF segments + mini YouTube player), **Accessible Outline Tree** (keyboard-navigable mirror of the canvas), and **Live Markdown / Mermaid Sync Editor**.
3. **Center Spatial Canvas (`flex-1`):** `@xyflow/react` viewport with subtle drafting dot grid, `ELK.js` collision-free positioning, floating bottom Walkthrough / Blind-Spot control bar, and collapsible **Right Inspector & Study Dock (`380px`)** hosting Node Lenses, Grounded Q&A Chat, and the Feynman Explain-It-Back evaluator.

## Elevation & Depth

Surfaces rely on tonal layering (`#edf3f7` ground → `#d0e0eb` docks → `#ffffff` cards) and `1px solid #aec3d2` borders at rest rather than ambient drop shadows.

### Shadow Vocabulary
- **Interactive Lift** (`box-shadow: 0 6px 20px -4px rgba(15, 82, 87, 0.14)`): Applied exclusively on hovered canvas nodes, selected cards, and floating toolbars.
- **Focus Ring** (`box-shadow: 0 0 0 2px #edf3f7, 0 0 0 4px #0f5257`): Applied on keyboard `:focus-visible` across buttons, handles, and node cards.

### Named Rules
**The Single-Elevation Rule.** Never stack a heavy blurred shadow under an already-bordered resting card; cards use `1px solid` borders at rest and lift only on active state or drag.

## Shapes

- **Node & Studio Cards:** `12px` corner radius (`rounded.lg`) with full 4-side structural borders.
- **Buttons, Inputs & Segmented Tabs:** `8px` corner radius (`rounded.md`), uniform `40px-44px` interactive height for comfortable pointer and touch targeting.
- **Citation, Timestamp & Relation Badges:** `6px` corner radius (`rounded.sm`) with compact monospace padding (`2px 8px`).

### Named Rules
**The Directional Quadrant Handle Rule.** Every Mind Map Node exposes invisible/subtle connection handles on all four edges (`Top`, `Right`, `Bottom`, `Left`), selected dynamically from parent-child geometry so connector curves always exit cleanly without crossing card bodies.

## Components

### Buttons
Tactile, flat-filled actions with `150ms` ease-out hover stepping (`translateY(-1px)`) and press feedback.
- **Shape:** `8px` radius (`rounded.md`), `40px` height (`44px` on launchpad hero CTA and mobile).
- **Primary:** Deep Petrol Teal (`#0f5257`) background, `#ffffff` ink, `10px 18px` padding. Hover darkens to `#0b3e42`.
- **Secondary / Ghost:** Elevated white (`#ffffff`) with `1px solid #aec3d2` border; ghost actions use transparent fill shifting to `#d9ecef` on hover.

### Chips
- **Style:** `6px` radius, `JetBrains Mono` `12px`, `1px solid` hue-tinted border.
- **State:** Citation chips (`#dbeafe` / `#1d4ed8`) open the exact source segment or seek the YouTube timestamp; Lens chips (`ELI5`, `Critic`, `First Principles`, `Code/Math`) highlight active Petrol Teal when generated on a node.

### Cards / Containers
- **Corner Style:** `12px` radius (`rounded.lg`) with crisp 4-side borders (`1px solid #aec3d2`)—never a colored left bar down one side of a rounded card.
- **Mind Map Node Card:** Displays hierarchy badge (`L0` root, `L1` branch), concise title, 1-2 line summary, optional inline KaTeX/code/Mermaid lens preview, clickable citation/timestamp pills, mastery status ring (`mastered` emerald, `partial` ochre, `needs_review` crimson), and hover quick-actions (`+ Expand`, `Lenses`, `Collapse`, `Delete`).
- **Active Recall Cloze Card:** Replaces child titles and summaries with `[ ? ]` veiled slots and an inline recall input bar until evaluated by AI or manually revealed.

### Inputs / Fields
- **Style:** Elevated white (`#ffffff`), `1px solid #aec3d2`, `8px` radius, `42px` height (or multi-line `textarea` in the Multi-Source Tray and Bi-Directional Markdown/Mermaid Editor).
- **Focus:** Border shifts to `#0f5257` with `2px` Petrol Teal focus ring; errors highlight border `#b91c1c` with inline recovery copy directly below the field.

### Navigation
- **Style:** Compact `52px` top studio bar with consistent icon-plus-label actions (`1.5px` Lucide stroke weight), zero eyebrow kickers above section headings, and responsive slide-over drawers below `1024px`.

## Do's and Don'ts

### Do:
- **Do** declare elevation once—use crisp `1px solid #aec3d2` borders at rest and apply directional shadow only on hover, selection, or floating overlays.
- **Do** route edges via directional Top/Right/Bottom/Left handles matching the active `ELK.js` layout (`Balanced`, `Logic Tree`, `Radial`, `Flowchart`).
- **Do** pair every spatial diagram node with clickable monospace source citations (`Page X` / `▶ MM:SS`) when grounded in uploaded PDFs or YouTube videos.
- **Do** render every view's 5 states (`loading` skeletons, instructional `empty`, `success`, `partial error`, `fatal error`) using real studio copy.

### Don't:
- **Don't** use violet, purple, or neon gradients anywhere in node palettes, buttons, or hero backgrounds.
- **Don't** place one-sided vertical accent bars along the left edge of rounded cards; use full 4-side borders, subtle surface tints, or leading badges instead.
- **Don't** place uppercase eyebrow kickers above headings or decorate idle surfaces with blurred frosted glass.
- **Don't** use fake export toasts, disabled placeholder buttons, or generic spinners inside empty content regions.
