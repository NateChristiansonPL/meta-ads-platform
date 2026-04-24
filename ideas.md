# Meta Ads Platform — Layout Mockup Ideas

## Context
6 components total:
- **Campaign Builder** (dominant) — spreadsheet-style builder with steps: Campaigns → Ad Sets → Creative Library → Ads → Export & Launch
- **5 Skills** (secondary): Weekly Optimization, Performance Insights, Creative Lifecycle, Structural Audit, Audience Overlap & Wasted Spend

The goal: Campaign Builder takes up the majority of the screen real estate. Skills are accessible but clearly subordinate.

---

<response>
<probability>0.07</probability>
<text>
## Option A — "Command Center" (Split-Stage)

**Design Movement:** Industrial Brutalism meets modern SaaS dark UI

**Core Principles:**
1. Campaign Builder occupies ~70% of the viewport as a persistent, full-height main stage
2. Skills live in a collapsible right-rail drawer — always visible as icon tabs but never intrusive
3. Hard edges, monospaced accents, strong grid lines — data-forward aesthetic
4. Hierarchy enforced through size, not color

**Color Philosophy:** Near-black (#0D0D0F) background, warm white (#F2F0EB) text, electric blue (#2563EB) for active states, amber (#F59E0B) for skill alerts — conveys precision and urgency

**Layout Paradigm:** Two-column asymmetric split. Left: 70% Campaign Builder with its own internal step-nav. Right: 30% collapsible skills rail with icon + label tabs stacked vertically. Skills panel slides open on click, overlaying nothing.

**Signature Elements:**
- Monospaced row numbers in the campaign table
- Thin 1px grid lines throughout — like a spreadsheet on steroids
- Skills rail uses pill-shaped status indicators (e.g., "2 alerts")

**Interaction Philosophy:** Everything keyboard-navigable. Tab through cells. Skills are "pull" — you open them when you need them, they don't interrupt.

**Animation:** Slide-in for skills panel (200ms ease-out). Row additions animate with a subtle height expansion. No bouncing or spring physics — this is a work tool.

**Typography System:** `IBM Plex Mono` for table data + labels, `IBM Plex Sans` for headings and descriptions. Tight line-height throughout.
</text>
</response>

<response>
<probability>0.06</probability>
<text>
## Option B — "Mission Control" (Top-Bar + Full Canvas)

**Design Movement:** NASA mission control meets Figma-style tool UI

**Core Principles:**
1. Campaign Builder is the full canvas — it fills the entire viewport below a slim top bar
2. Skills are accessed via a persistent top-bar icon cluster (5 icons, each opens a floating panel)
3. Floating skill panels are modal-like overlays that don't displace the builder
4. Minimal chrome — every pixel serves the builder

**Color Philosophy:** Deep navy (#0A0E1A) background, crisp white text, cyan (#06B6D4) as the accent for skill triggers, green (#10B981) for active/live states — feels like a live operations dashboard

**Layout Paradigm:** Full-bleed Campaign Builder below a 48px top bar. Top bar contains: logo left, step breadcrumb center, skill icons right (5 icons + account selector). Skills open as floating panels anchored to their icon.

**Signature Elements:**
- Floating skill panels with frosted glass effect (backdrop-blur)
- Step breadcrumb in the top bar shows current builder stage with progress dots
- Skill icons show a small badge count for pending insights

**Interaction Philosophy:** Skills are "ambient" — they float above the work without taking space. Dismiss with Escape or click-away. Builder never loses focus.

**Animation:** Skill panels drop down from the top bar (scale + fade, 150ms). Builder rows use a subtle flash highlight on new additions.

**Typography System:** `Space Grotesk` for UI labels and headings, `JetBrains Mono` for table data. Generous letter-spacing on section labels.
</text>
</response>

<response>
<probability>0.08</probability>
<text>
## Option C — "Workbench" (Left Nav + Dominant Center Stage)

**Design Movement:** Linear/Notion-style productivity tool with editorial typography

**Core Principles:**
1. Narrow left sidebar (64px collapsed / 220px expanded) for navigation between builder and skills
2. Campaign Builder dominates the center — full height, full width minus sidebar
3. Skills each get their own "page" in the sidebar nav, but the builder is the default/home view
4. Visual weight difference is extreme: builder uses full-bleed table, skills use centered card layout

**Color Philosophy:** Off-white (#F8F7F4) background for the builder area, slate sidebar (#1C1C1E), blue-violet (#4F46E5) for primary actions, muted sage (#6B7280) for skill labels — calm, focused, editorial

**Layout Paradigm:** Left sidebar (icon-only collapsed by default) + full-width center stage. Builder = home. Each skill = sub-page. Sidebar items: Campaign Builder (prominent, top), then a divider labeled "SKILLS", then 5 skill items below.

**Signature Elements:**
- Sidebar has a clear visual break between "Builder" and "Skills" sections
- Builder view has a sticky step-progress bar at the top (Campaigns → Ad Sets → Creative Library → Ads → Export)
- Skill pages use a two-column layout: config left, output right

**Interaction Philosophy:** Navigation-first. The sidebar makes the hierarchy explicit — builder is primary, skills are tools. No overlapping panels or drawers.

**Animation:** Page transitions use a subtle fade (100ms). Sidebar expand/collapse uses width transition (200ms). Table rows slide in from left on load.

**Typography System:** `Instrument Serif` for page titles (adds editorial weight), `Geist` for body and UI. Strong typographic hierarchy between builder headers and skill headers.
</text>
</response>

---

## Selected Approach
All three options will be presented as interactive mockup tabs on the website so the user can compare them side-by-side.
