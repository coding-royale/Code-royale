---
name: Code Royale
description: A night desk where one sheet of paper unfolds into a duel — matte paper surfaces, gold foil ranks, and aerospace spec-mono on a near-black warm ground.
colors:
  desk-bg: "#0f0b09"
  ink: "#f3f2ed"
  paper: "#f1efea"
  paper-ink: "#16100b"
  gold: "#e0b364"
  bronze: "#8f5d04"
  gold-ink: "#201308"
  valley: "#cadbe3"
  valley-deep: "#0a2737"
  mountain: "#29231e"
  muted-ink: "#a49d94"
  paper-muted: "#5a5147"
  destructive: "#dd503f"
  ring: "#cca45e"
  chart-emerald: "#56ae6c"
  chart-sky: "#81a4b9"
  chart-clay: "#ce7951"
typography:
  display:
    fontFamily: "JetBrains Mono, ui-monospace, \"SF Mono\", Menlo, monospace"
    fontWeight: 700
    letterSpacing: "-0.03em"
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"Segoe UI\", Helvetica, Arial, sans-serif"
  label:
    fontFamily: "JetBrains Mono, ui-monospace, \"SF Mono\", Menlo, monospace"
rounded:
  sm: "8px"
  md: "11px"
  lg: "14px"
  xl: "20px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.gold}"
    textColor: "{colors.gold-ink}"
    rounded: "{rounded.lg}"
    padding: "12px 16px"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "12px 16px"
  card-sheet:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.paper-ink}"
    rounded: "{rounded.xl}"
---

# Design System: Code Royale

## Overview

**Creative North Star: "The Miura Fold"**

Code Royale is one sheet of paper on a night desk. Every screen surface is a fold of the same deployed Miura sheet — never a generic dark dashboard. The desk is near-black and warm, ruled by a faint diagonal crease grid (mountain folds in warm gray, valley folds in pale blue). Content deploys onto matte paper sheets: cards, panels, dialogs, popovers, and tables all read as paper catching the light. Gold foil is reserved for what the product values — rating, trophies, streaks, and the primary action. Ratings, match ids, timers, and technical labels are printed in aerospace spec-mono.

The mood is a competitive game table at night: sharp, legible, high-stakes, and materially honest. Nothing glows, nothing is glass, nothing is neon-on-black. A sheet deploys once on load (`sheet-deploy`, exponential ease-out, clip-path unfold); everything else sits still and lets the content speak.

**Key Characteristics:**
- Dark warm desk ground, paper-white deployed sheets, gold foil accents — three materials, no gradients-as-decoration.
- Aerospace spec-mono (JetBrains Mono) is the display voice; system sans is the reading voice.
- Geometry is the language of folding: parallelogram edges, diagonal crease rules, valley fold lines.
- Rarity of gold: it carries rank, streak, and the single primary action, never broad fills.
- The desk is the chrome; `.sheet` scopes paper values to content surfaces.

## Colors

A warm near-black desk, matte paper sheets, and a restrained gold foil — the palette is warm through every value, never cool slate or blue-black.

### Primary
- **Gold Foil** (`#e0b364`): rating, trophies, streaks, the primary action. Used as plates (solid fill with dark ink) on both desk and paper. Bright on the desk; on paper it stays bright only as a *plate*.
- **Bronze Foil** (`#8f5d04`): gold *ink* on paper. The `.sheet` scope re-maps `--primary` to this darker gold so gold text clears the 4.5:1 contrast floor on paper; on the dark desk `--primary` stays the bright gold. Two golds, one system: `--primary-plate` is always the bright foil, `--primary` is the legible ink on paper.
- **Gold Ink** (`#201308`): text on gold plates. Near-black warm brown.

### Secondary
- **Valley Blue** (`#cadbe3`, deep `#0a2737`): the pale-blue crease — used for the accent surfaces (fold marks, logo plates), selected states, and the valley crease lines. Low saturation; it reads as light on the desk's dark, as a quiet blue-gray on paper.

### Neutral
- **Desk Background** (`#0f0b09`): near-black, warm. The ground every surface deploys from. Light mode (`:root`) uses the warm paper desk (`#f3f2ed`).
- **Paper** (`#f1efea`): the deployed sheet (cards, dialogs, popovers, tables, sheets). Warm matte white.
- **Paper Ink** (`#16100b`): text on paper.
- **Desk Ink** (`#f3f2ed`): text on the dark desk (paper-white).
- **Mountain** (`#29231e`): borders and the mountain crease lines on the desk.
- **Muted Ink** (`#a49d94` desk / `#5a5147` paper): secondary text, tinted warm from the ground — never gray.
- **Destructive** (`#dd503f`): errors and fail states.

### Named Rules
**The One Sheet Rule.** Every content surface is paper. If it holds content, it is a `.sheet` (cards, panels, popovers, dialogs, tables); if it is chrome, it is the desk. No third material, no glass, no glow.

**The Two Golds Rule.** On paper, gold text uses bronze (`--primary`); gold plates use the bright foil (`--primary-plate`). A bright gold text on paper is a defect, not a style.

**The Rarity of Gold Rule.** Gold carries rank, streak, and the one primary action. It is not a broad fill; its rarity is the point.

## Typography

**Display Font:** JetBrains Mono (self-hosted via `next/font`), weight 700, tracking `-0.03em`.
**Body Font:** System sans (`-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial`).
**Label/Mono Font:** JetBrains Mono — ratings, match ids, timers, crease ids, technical labels.

**Character:** The aerospace mono display voice against a quiet humanist reading face. Headings read like spec-sheet labels stamped on paper; body copy reads like a printed rulebook. Mono is the world's voice, never a costume — it prints the data, the numbers, the ids.

### Hierarchy
- **Display** (700, `text-4xl`–`text-7xl`, i.e. 36–72px): landing hero, page-level h1s. Mono, tracking-tight.
- **Headline** (700, `text-3xl`–`text-4xl`): section headings (`h2`). Mono with the diagonal fold-rule beneath.
- **Title** (600, `text-base`–`text-xl`): card and panel titles. Mono.
- **Body** (400, `text-sm`–`text-base`, ~65–75ch max width): reading text in the sans.
- **Label** (500–600, `text-[10px]`–`text-xs`, uppercase, tracking `0.15em`–`0.4em`): crease ids, sheet ids, spec labels like `sheet 01 · 1v1 · rating ±32`, `DEMO FEED · EST. 45s`. Mono, always.

### Named Rules
**The One Voice Rule.** Mono is the display voice for all `h1`/`h2`. A sans-serif display face is not part of this world.

## Layout

The desk is ruled by a diagonal crease grid: `repeating-linear-gradient(-6deg, …)` at 46px pitch (warm gray mountain) and `84deg` at 74px pitch (pale blue valley), both at 4–5% opacity. Content sits in a centered max-width container (`max-w-6xl`, `px-6`), sheets landing on a 4px spacing rhythm (`--spacing: 0.25rem`). Vertical rhythm favors generous separation between sections and tighter grouping within them — more space above a heading than below. Responsive: `sm` (640) reflows hero stacks, `md` (768) turns grids from single to three columns, `lg` (1024) activates the app shell sidebar.

### Named Rules
**The Desk Rule.** The crease grid is the ground, painted on `body`. A diagonal fold line or crease texture on top of an already-papered surface is doubling the material — don't.

## Elevation & Depth

A hybrid: tonal layering for surfaces, soft ambient shadows for lift. Depth is conveyed by the dark desk receding beneath paper, and by warm shadows (`--shadow-color` warm brown at low opacity on light, black at `0.35` in dark mode). Shadows carry an offset and a soft blur — no hard offset blocks, no zero-blur costumes.

### Shadow Vocabulary
- **Card** (`0 3px 6px -1px`, `0 2px 4px -2px` at `0.10`–`0.12` desk opacity): resting sheets.
- **Lifted** (`0 14px 28px -4px`, `0 6px 12px -4px` at `0.44`): the deployed hero sheet, hovered cards.
- **Foil plate inset** (1px white top inset + tight shadow): gold plates catch light at their top edge.

### Named Rules
**The Paper-Over-Desk Rule.** A sheet casts its shadow onto the desk; it never glows. Depth comes from the ground receding, not from the surface emitting light.

## Shapes

The form language is folded geometry. Sheets use generous radius (`--radius: 14px`; cards `rounded-xl` ≈ 20px); small controls are pills. Signature shapes: `parallelogram` and `parallelogram-sm` clip a sheet's edge along the tessellation diagonal (the CR logo mark, accent plates); `fold-rule` scores a pale-blue valley line under a heading; the `sheet-deploy` animation unfolds a sheet from a horizontal crease (clip-path polygon reveal, 0.7s, `cubic-bezier(0.22, 1, 0.36, 1)`, disabled under `prefers-reduced-motion`).

### Named Rules
**The Fold Geometry Rule.** Any strong silhouette must be a fold: a parallelogram edge, a diagonal crease. Circles are for small controls and avatars only; a sheet does not become a circle.

## Components

### Buttons
- **Shape:** `rounded-lg` (14px), full-height padding `h-9 gap-1.5 px-3` (lg: `h-9 px-2.5`), `border-transparent`.
- **Primary:** gold foil plate — `background: var(--primary-plate)`, `color: var(--primary-foreground)`, soft shadow. Hover darkens toward `--primary` and lifts shadow. A primary action on the desk is the same plate the sheet's own action uses.
- **Secondary:** `bg-secondary` (muted desk tone) with `secondary-foreground`.
- **Outline:** `border-border bg-background`, darkens `bg-muted` on hover.
- **Ghost:** no fill, `hover:bg-muted`.
- **Focus:** 3px `ring-ring/50` focus-visible ring; gold on the desk, bronze on paper.
- **LinkButton** variants mirror Button variants; used where the action navigates.

### Cards / Containers
- **Corner Style:** `rounded-xl` (≈20px).
- **Background:** paper `--card` (`.sheet` scope) — every Card is a deployed sheet.
- **Shadow:** the Card shadow vocabulary above; hover raises to `shadow-md` and lifts 1–2px.
- **Border:** none at rest; a 1px `ring-1` at low opacity (8–10%) outlines the sheet edge like a cut edge.
- **Internal Padding:** `p-6` (`sm:p-8`) in cards, `gap-4` between rows.

### Inputs / Fields
- **Style:** `border-input` 1px, radius 14px, desk-muted background, `--ring` caret.
- **Focus:** 3px gold/bronze ring, border to `--ring`.
- **Disabled:** `opacity-50`.

### Navigation
Top bar on desk chrome; `parallelogram-sm bg-accent` fold mark logo. Nav links in the desk ink; active link gets `text-primary` gold plus a soft shadow. Mobile: hamburger → sheet panel (`Sheet` component, paper surface).

### The Deployed Match Sheet (signature)
The landing hero and dashboard primary section use `sheet-deploy sheet`: a paper sheet that unfolds on load, carrying a mono matchmaking feed, a `GO`/`Find a Match` gold plate, and crease-id labels (`sheet 01 · 1v1 · rating ±32`, `M-01 · V-02 · R-03`). It is the world in miniature: paper, gold, mono, and a fold.

## Do's and Don'ts

### Do:
- **Do** scope paper values with the `.sheet` class for any content surface; keep the desk dark.
- **Do** use gold for rank, streak, and the single primary action — and use the bright foil (`--primary-plate`) for plates, bronze (`--primary`) for gold text on paper.
- **Do** print match ids, ratings, timers, and technical labels in JetBrains Mono.
- **Do** label illustrative or demo data honestly (e.g. `DEMO FEED`).
- **Do** let headings stand alone; keep crease-id labels below or inside the sheet, never as an eyebrow above the heading.

### Don't:
- **Don't** use purple/violet or cyan-on-dark palettes — the AI-generative tells this world deliberately refuses.
- **Don't** put gold as bright text on paper; use bronze.
- **Don't** add a sans-serif display face; h1/h2 are mono.
- **Don't** use hard offset shadows (`4px 4px 0`) or zero-blur blocks outside this world — shadows are soft and offset.
- **Don't** use gradient text, glass-blur decoration, or side stripes; the sheet and its folds carry the design.
- **Don't** use emoji or unicode glyphs as interface icons; icons come from lucide-react in one consistent stroke.
