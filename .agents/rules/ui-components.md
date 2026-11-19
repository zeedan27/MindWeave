---
trigger: glob
globs: "src/components/**/*.tsx, src/app/**/*.tsx"
description: Visual standards, accessibility, and design-token adherence for UI components.
---

# UI Component Standards
- Prevent generic styling patterns (no purple/violet gradients, no one-sided vertical accent bars on rounded cards, no uppercase eyebrow kickers above headings, no decorative frosted glass).
- Ensure every interactive element exposes a `:focus-visible` ring, handles keyboard events, and provides ARIA labels.
- Map all component styles directly to CSS variables and tokens from `DESIGN.md` (`#edf3f7`, `#c3d7e5`, `#d0e0eb`, `#ffffff`, `#141414`, `#3f4756`, `#0f5257`, `Schibsted Grotesk`, `JetBrains Mono`).
- Declare elevation once: `1px solid #aec3d2` borders at rest, directional shadow (`0 6px 20px -4px rgba(15, 82, 87, 0.14)`) only on hover, active selection, or floating overlays.
