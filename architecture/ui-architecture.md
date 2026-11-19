# SOP: UI Architecture & Design System Enforcement

## 1. Authoritative Design Contract (`DESIGN.md` + `.impeccable/design.json`)
- **North Star:** *"The Architectural Drafting Studio"*
  - Light Surface: Drafting Paper (`#edf3f7`), Studio Putty (`#c3d7e5`), Panel Slate (`#d0e0eb`), Elevated Card (`#ffffff`), Carbon Ink (`#141414`), Tinted Slate (`#3f4756`), Hairline Border (`#aec3d2`), Primary Deep Petrol Teal (`#0f5257`), Citation Cobalt (`#1d4ed8`).
  - Dark Surface (`.dark`): Midnight Blueprint (`#0a0d14`), Dark Panel (`#131824`), Dark Ink (`#e9edf3`), Cornflower Accent (`#5ab9fc`).
  - Semantic Roles: Consensus Emerald (`#156f4c`), Unique Ochre (`#b45309`), Contradiction Crimson (`#b91c1c`).
- **Strict Visual Bans (`craft-floor.md`):**
  - Zero violet/purple/lavender anywhere.
  - Zero uppercase eyebrow kickers above headings.
  - Zero one-sided accent bars on rounded boxes (full 4-side `1px solid` borders only).
  - Single-elevation surfaces (`1px solid` at rest; offset lift shadow on hover/selection/floating HUD).

## 2. Two-Surface Architecture & 5 UI States
1. **Studio Launchpad (`StudioLaunchpad.tsx`):**
   - Hero-Collage composition (`6/6` desktop grid stacking text-first below `1024px` / `390px`) pairing the Multi-Source Synthesis Tray + 1-click Flagship Demo button on the left with a live miniature architectural canvas collage preview on the right.
   - Local Workspace Library below with `.mindweave.json` file import and empty-library instructional state.
2. **3-Zone Spatial Canvas Studio (`page.tsx`):**
   - `StudioHeader` (`52px`), collapsible `LeftSourceAndSyncDrawer` (`Sources`, `Outline`, `Markdown/Mermaid Sync`), center `SpatialCanvas` (`React Flow` + `ELK.js` + `WalkthroughAndStudyBar`), and collapsible `RightCognitiveDock` (`Inspector & Lenses`, `Chat & Feynman`, `Blind Spots`).
3. **5 Essential States:**
   - **Loading:** Skeleton studio placeholder / weaving progress drawer showing active source count (never hardcoded to YouTube).
   - **Empty:** Instructional onboarding cards in Launchpad library, empty chat, and empty blind-spot panels.
   - **Success:** Interactive spatial canvas with grounded citations and smooth controls.
   - **Partial Error:** Inline dismissal alert banner with recovery actions (e.g., `"Open AI Settings"` or `"Continue Offline"`).
   - **Fatal Error:** Clean boundary fallback offering workspace JSON recovery and reset.

## 3. Accessibility & Motion
- Skip link (`Skip to main workspace`) reaching interactive studio controls immediately on Tab.
- Accessible Outline Tree mirroring every spatial node for full keyboard & screen-reader parity.
- `prefers-reduced-motion: reduce` disables transitions and smooth camera pan animations.
