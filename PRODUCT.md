# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Competitive programmers and casual coders who enjoy rapid, head-to-head problem solving. Primary situation: a player wants to prove speed and skill against another human (or a bot) under time pressure, and to track that progress. Secondary use: solo practice to improve speed and correctness.

## Product Purpose

Code Royale is a real-time competitive coding game. Two players solve the same coding problem under time pressure; the first to pass all test cases wins the match. The product makes competitive coding feel like a fast, social game rather than a solitary exercise — with ranked duels, bot battles, clubs, friends, and a practice arena around a single core loop.

## Positioning

Speed is the differentiator: a live 1v1 duel where correctness and submission time both decide the winner, wrapped in a persistent competitive layer (ELO ratings, leaderboards, clubs, trophies, streaks) that plain judge-and-practice platforms do not have.

## Operating Context

- Players sign in (email/password or GitHub OAuth via Supabase), land on a dashboard, and queue for a match, challenge a friend, battle a bot, or practice solo.
- A match: both players receive the same problem; each writes code in a shared editor and submits; the server judges via Judge0; the first passing submit wins.
- Ranked matches update ELO; wins/losses, streaks, trophies, club contributions, and leaderboard position persist to Supabase.
- Clubs: create/join/leave, member roles (host/elder/member), trophies contributed, invite links, private-club requests.
- Friends: send/accept/block, live presence, friend matches.
- Profiles: rating, rank tier, wins/losses, badges, team/club, progress, match history.
- Tournaments: planned; currently a rules page with a guidelines-acceptance modal (entry gated by acceptance when a tournament begins).

## Capabilities and Constraints

- Next.js 16 App Router, React 19, TypeScript 5, Tailwind CSS 4, bun; shadcn/ui component set with a darkmatter-style theme (neutral monochrome + blue accent, light/dark via next-themes).
- Supabase for auth, database, and realtime; Judge0 for code execution via server-side API routes.
- Route inventory (all must keep working): `/` landing, `/home`, `/game-modes`, `/auth/login`, `/auth/signup`, `/practice`, `/practice/[slug]`, `/bot-battle`, `/match/[matchId]`, `/leaderboard`, `/clubs`, `/clubs/[clubId]`, `/friends`, `/profile`, `/settings`, `/team`, `/tournaments`.
- API routes for matchmaking, match completion, practice submit, bot battles, clubs, friends, profile progress, telemetry.
- Supabase realtime used for friend presence; live match state driven by API + Supabase.
- Editor surfaces (practice arena, match arena, bot battle) are code-editor UIs with a split/panes layout; performance and readability matter there.

## Brand Commitments

- Name: Code Royale.
- Existing logo asset: `/images/logo-icon.svg` (kept unless explicitly replaced).
- Tone: competitive, sharp, energetic; "battleground", "duel", "arena" vocabulary is established in copy.

## Evidence on Hand

- Real product: the full working app (routes, API, Supabase schema) is the evidence base. README and docs/ describe architecture and setup.
- No external testimonials, case studies, pricing, or marketing assets exist. Landing page copy is real product copy (feature list, match preview) — do not invent customers, benchmarks, or revenue claims.
- Logo: `/images/logo-icon.svg`.

## Product Principles

1. The match is the product: every design choice must make the live duel feel fast, legible, and high-stakes.
2. Operate first: dashboards, arenas, and editors must stay scannable and low-friction; expression serves clarity.
3. Speed is identity: rating, streaks, trophies, and live presence are the emotional engine — keep them visible and alive.
4. Social gravity: friends, clubs, and leaderboards should make the arena feel inhabited, not empty.
5. Consistency over novelty in behavior: the revamp is a new visual world, never a change to what works.

## Accessibility & Inclusion

No product-specific accessibility standard is established. Preserve semantic HTML, keyboard reachability, focus rings, and contrast across the new theme; the code editor must remain usable by keyboard and screen readers as far as the underlying editor allows.