---
name: Code Royale
description: A real-time competitive coding battle arena — players race the same problem under one clock; first to pass the tests wins.
colors:
  arena-bg: "oklch(0.1410 0 0)"
  arena-bg-light: "oklch(1.0000 0 0)"
  ink: "oklch(0.9850 0 0)"
  ink-light: "oklch(0.1450 0 0)"
  card-dark: "oklch(0.2100 0 0)"
  card-light: "oklch(1.0000 0 0)"
  muted-dark: "oklch(0.2520 0 0)"
  muted-light: "oklch(0.9670 0.0029 264.5419)"
  muted-ink-dark: "oklch(0.7080 0 0)"
  muted-ink-light: "oklch(0.5510 0.0234 264.3637)"
  arena-indigo: "oklch(0.2727 0.0415 262.8816)"
  arena-indigo-foreground: "oklch(0.8658 0.0433 262.8816)"
  arena-indigo-light: "oklch(0.4470 0.1279 262.8816)"
  arena-indigo-foreground-light: "oklch(0.9448 0.0237 262.8816)"
  trophy-gold: "#d97706"
  victory-green-dark: "oklch(0.7214 0.1337 49.9802)"
  victory-green-light: "oklch(0.5940 0.0443 196.0233)"
  boss-rose: "#e11d48"
  destructive-dark: "oklch(0.5940 0.0443 196.0233)"
  destructive-light: "oklch(0.6368 0.2078 25.3313)"
  hairline-dark: "oklch(0.2520 0 0)"
  hairline-light: "oklch(0.9276 0.0058 264.5313)"
typography:
  display:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, Helvetica, Arial, sans-serif"
    fontSize: "clamp(2.5rem, 6vw, 4.5rem)"
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, Helvetica, Arial, sans-serif"
    fontSize: "clamp(1.75rem, 4vw, 3rem)"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  title:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, Helvetica, Arial, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "-0.01em"
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, Helvetica, Arial, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, Helvetica, Arial, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "0.001em"
  micro:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, Helvetica, Arial, sans-serif"
    fontSize: "0.65rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "0.001em"
  mono:
    fontFamily: "JetBrains Mono, ui-monospace, SF Mono, Menlo, monospace"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.6
rounded:
  sm: "calc(0.75rem * 0.6)"
  md: "calc(0.75rem * 0.8)"
  lg: "0.75rem"
  xl: "calc(0.75rem * 1.4)"
  pill: "9999px"
spacing:
  xs: "0.25rem"
  sm: "0.5rem"
  md: "0.75rem"
  lg: "1rem"
  xl: "1.5rem"
  xxl: "2rem"
  section: "5rem"
components:
  button-arena:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.arena-bg-light}"
    rounded: "{rounded.md}"
    padding: "0.625rem 1rem"
  button-arena-hover:
    backgroundColor: "oklch(0.9850 0 0 / 0.8)"
  button-outline:
    backgroundColor: "{colors.arena-bg-light}"
    textColor: "{colors.ink-light}"
    rounded: "{rounded.md}"
    padding: "0.625rem 1rem"
  input-field:
    backgroundColor: "transparent"
    textColor: "{colors.ink-light}"
    rounded: "{rounded.md}"
    padding: "0.25rem 0.625rem"
  card-surface:
    backgroundColor: "{colors.card-light}"
    textColor: "{colors.ink-light}"
    rounded: "{rounded.lg}"
    padding: "1.25rem"
  badge-pill:
    backgroundColor: "{colors.muted-light}"
    textColor: "{colors.muted-ink-light}"
    rounded: "{rounded.pill}"
    padding: "0.125rem 0.5rem"
---

# Design System: Code Royale

## Overview

**Creative North Star: "The Championship Arena"**

Code Royale is a duel stage more than a dashboard. The base materials stay calm and tactical — a cool, near-monochrome graphite system on which data reads clean — but the money moments are lit like a live 1v1: a spotlit **VS frame**, **trophy gold** for what you can win, a faint **arena glow** rising behind heroes, and a precision tape of **JetBrains Mono** clock running on every competitive surface. It should feel like a contender walks into an arena at the start of every match, not like they opened a settings screen.

The personality is *tactile and confident with a twist of playfulness* — deliberately, so the two reads coexist instead of fighting. The system is not minimalist (it has real tone, pattern, and garnish) but it is never cluttered: every gradient, glow, and motion earns its place under one rule — *game energy, one meter at a time*. Cards are crisp with hairlines; buttons press like physical keys; hit markers, streak flames, and VS dividers add the play. The clock, the rank, and the opponent are always the loudest things in the room.

**Key Characteristics:**
- Cool graphite base, one design-led accent (Arena Indigo), gold reserved for stakes.
- Flat by default; depth via hairlines, tonal cards, and a rare ambient arena glow.
- Medium corners (8–12px) everywhere; the pill is reserved for micro-status only.
- Playful punctuation — streak flame, VS divider, hit markers — applied sparingly.
- JetBrains Mono as the game's voice: clocks, match numbers, telemetry, tokens.
- Tactile buttons: press down and scale on click; ghost links are never underlined-only.

## Colors

A cool, mostly neutral arena lit by a single indigo accent; gold signals reward, green signals victory, rose signals the hard lane. Dark and light modes share roles; indigo and gold work in both.

### Primary
- **Ink** (`oklch(0.9850 0 0)` dark / `oklch(0.1450 0 0)` light): the arena's primary — solid, confident surface fill for buttons and the strongest text. Used as the fill color of primary buttons and head heads.
- **Arena Indigo** (`oklch(0.2727 0.0415 262.8816)` dark / `oklch(0.4470 0.1279 262.8816)` light): the single design-led accent. Marks active nav, icon plates, the queue spinner, selection, and the soft selection/veil tint. Never used to shout — it is the "you are here / you are matched" color.

### Secondary
- **Muted** (`oklch(0.2520 0 0)` dark / `oklch(0.9670 0.0029 264.5419)` light): secondary surfaces, quiet cards, and filled badges. **Muted Ink** (`0.7080` / `0.5510`): secondary text, hints, and descriptive copy.

### Tertiary
- **Trophy Gold** (`#d97706`): the color of the prize. Streak flames, trophy count, "wins the trophies" badges, high-impact league chips. The One Prize Rule: gold appears only where something can actually be won.
- **Victory Green** (`oklch(0.7214 0.1337 49.9802)` dark / `oklch(0.5940 0.0443 196.0233)` light): match found, solved, success.
- **Boss Rose** (`#e11d48`): the hard difficulty lane and highest stakes.

### Neutral
- **Arena Base** (`oklch(0.1410 0 0)` dark / `oklch(1.0000 0 0)` light): the floor every page rests on.
- **Card** (`oklch(0.2100 0 0)` / `oklch(1.0000 0 0)`): raised surfaces, differentiated from floor by tone alone (or hairline).
- **Hairline** (`oklch(0.2520 0 0)` / `oklch(0.9276 0.0058 264.5313)`): border/divider — 1px, cool, quiet. The boundary language for the whole arena.

### Named Rules
**The One Prize Rule.** Gold is used only for a stake — a trophy count, a streak, a "High Impact" chip. The moment gold appears just to decorate, it stops meaning *win*.
**The Indigo-Accent Rule.** Indigo is the interaction voice: active, matched, selected, focused. It marks state and choice, never identities the whole page. Indigo is a cursor through the arena, not the arena itself.

## Typography

**Display Font:** System Sans (with -apple-system, Segoe UI, Helvetica fallbacks)
**Body Font:** System Sans (same stack)
**Label/Mono Font:** JetBrains Mono (with ui-monospace, SF Mono, Menlo fallbacks)

**Character:** The sans is clean, confident, and neutral — the announcer. Mono (JetBrains) is the game's ground truth: clocks, ratings, problem tokens, terminal/telemetry text. Together they say "competition on the surface, precision underneath."

### Hierarchy
- **Display** (700, clamp(2.5rem→4.5rem), 1.05): hero statements — "Think fast. Code faster." Tight tracking, used once per landing view.
- **Headline** (700, clamp(1.75rem→3rem), 1.1): section and page leaders — "Choose your battle mode."
- **Title** (600, 1.25rem, 1.4): card and panel titles, mode names.
- **Body** (400, 1rem, 1.6): description copy; max ~65ch.
- **Label** (600, 0.75rem, uppercase where the original does): eyebrow chips ("Arena", "Ranked & Core Modes") and tab labels.
- **Micro** (600, 0.65rem, uppercase where the original does): the tiniest meta text — trophy counts, league lanes, timestamp rows, tiny status marks. This is the one deliberate micro range; literals between 9–13px are the optical tuning of this step, not drift.
- **Mono** (400, 0.875rem, 1.6): clocks, ratings, match numbers, code. Numbers read better in mono — keep them that way.

### Named Rules
**The Red-Letter-Second Rule.** Uppercase eyebrows with wide tracking (0.15–0.25em) are reserved for arena staging — "ARENA", "OPPONENT FOUND", "RANKED" — and should not creep into body labels of ordinary panels.
**The Mono-Clock Rule.** Any time, rating, or countdown renders in JetBrains Mono. It is the metronome of the game and its mono-ness is the giveaway that pressure is on.

## Layout

Everything runs on the base `0.25rem` spacing scale; the practical rhythm is 4 / 8 / 12 / 16 / 24 / 32 / 40 / 48 / 80. Content containers are `max-w-6xl`/`max-w-7xl` with `px-4 sm:px-6 lg:px-8`. Cards in grids use tight 12–16px gaps (`gap-3/gap-4`); sections breathe with 32–40px vertical separation.

Responsive behavior: multi-column grids collapse to one column under `md`; the app sidebar collapses to icon-only; the primary action stays first in source order on mobile. Competition surfaces (match heartbeat, timer) keep their largest reading at the top center so they survive narrow screens.

## Elevation & Depth

Depth is **flat by default**, carried by hairlines and tonal layering — a card is a card because its tone differs from the floor, not because it floats. Shadows exist but stay restrained (`shadow-sm`/`shadow-md`, very low alpha) and only escalate on hover or for floating elements. The one theatrical gesture is the **arena glow**: a soft radial tint of Arena Indigo rising behind hero/landing sections and the match-making ring. It is ambient, not chrome, and appears at most one or two places per screen.

### Shadow Vocabulary
- **sm/md** (shadcn defaults, `hsl(0 0% 0% / 0.05)`): resting cards; hover lifts one step.
- **arena glow** (radial indigo tint, ~12–20% alpha): hero backdrops only.

### Named Rules
**The Flat-First Rule.** No element shadows itself at rest. A surface is either tonally distinct or hairline-bordered, never heavy-shadowed. Shadows respond to state (hover, focus, elevation), not to default.

## Shapes

Form language is **medium corners on everything, pill for micro-status only**. Base radius is `0.75rem` (12px); chips and small controls slide down toward 8px; cards and panels sit at 12px; full pills are exclusive to status badges, avatars, and the streak flame. This keeps the arena sharp — the playful moments are those pills and hit markers, never the panels.

## Components

For each component, the lead character line, then shape, color, and states. Tactile and confident, with a light playful twist in the details.

### Buttons
- **Shape:** medium corners (8–10px, `rounded-lg`/`rounded-md`), comfortable vertical padding.
- **Primary:** solid **Ink** fill, Ink-foreground text, subtle border glow on hover; hover lifts one shadow step (`hover:shadow-md`).
- **Press / Focus:** the tactile centerpiece — on `:active` the button translates down and scales to ~0.98 (`active:translate-y-px active:scale-[0.98]`); focus shows a ring. Buttons feel like they click.
- **Outline:** hairline border, transparent fill, fills muted on hover — the "back" and secondary action voice.
- **Ghost / Link:** text-only, uses muted hover fill for out-of-line actions; underline is never the default affordance.

### Badges / Chips
- **Style:** pill (`rounded-full`), tight padding, 12px semi-semibold text, subtle filled or hairline outline; trophy chips get a tiny gold Trophy glyph.
- **State:** filled (status), outline (attribute), gold (high trophy impact). Locked features dim and carry a lock glyph.

### Cards / Containers
- **Corner Style:** `rounded-xl` (12px).
- **Background:** Card tone (distinct from the Arena Base floor by tone), `ring-1 ring-foreground/10` hairline.
- **Shadow Strategy:** `shadow-sm` at rest; `hover:shadow-md` + a slight `-translate-y` lift on interactive cards only.
- **Border:** hairline ring, never a heavy stroke.
- **Internal Padding:** 20px (`p-5`) default; leading cards at `p-6 sm:p-8`.

### Inputs / Fields
- **Style:** transparent fill over hairline; mono for code/metric values; 8–10px corners.
- **Focus:** border shifts to ring color + a 3px soft ring — the same interaction voice as indigo selection elsewhere.
- **Error / Disabled:** destructive tint on state only; disabled dims to 50%.

### Navigation
- **Top bar / App shell:** sticky, `bg-background/80` + `backdrop-blur-xl`, hairline bottom edge. The logo tile is a quiet rounded plate; active nav uses the indigo accent fill.
- **Sidebar:** icon-collapsible; active item in Arena Indigo; muted at rest; the player chip (avatar + handle) anchors the footer.

### Signature Component — The VS Frame
The duel call-out: opponent name vs-handle, mono rating under each, and a centered **VS** divisor (outlined pill) between them — the arena's recurring stage device on the landing page, match preview terminal, and the home quick-play area.

### Signature Component — The Arena Glow Ring & Queue
Matchmaking animates a pulsing indigo ring around the queue spinner (`animate-ping` halo + spinning loader), the one place an explicit, alive motion loop is allowed while searching.

## Do's and Don'ts

### Do:
- **Do** keep surfaces flat at rest and cells distinct by tone and hairline, not shadow.
- **Do** render every clock, rating, and countdown in JetBrains Mono.
- **Do** reserve Arena Indigo for the interaction voice: active, matched, selected, focused.
- **Do** spend gold only on a real stake — trophies, streaks, high-impact rewards.
- **Do** use the VS frame for any true 1v1/head-to-head moment.
- **Do** let buttons press physically on click (translate + scale) and lift a shadow step on hover.
- **Do** add the playful punctuation (flame, pill hit markers, ping) sparingly — one per view.

### Don't:
- **Don't** use heavy dropshadows by default; no element shadows itself at rest.
- **Don't** make the pill the card corner; pills are for status and avatars, 12px is the card language.
- **Don't** let gold decorate without a prize, or indigo cover a whole page.
- **Don't** use uppercase wide-tracked eyebrows for ordinary panel labels.
- **Don't** reach for neon, glassmorphism, or purple-and-cyan gradients — the arena is cool graphite with gold stakes, not an arcade laser show.
- **Don't** underline as the primary button affordance; use fill and press instead.