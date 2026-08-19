# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Casual tech friends who want to duel each other — the social, bragging-rights crowd more than the ladder grinders. They drop in to set up a 1v1 (or a chaotic 4-player brawl) with people they know, race the same problem under a clock, and take the win. A secondary slice are competitive developers between matches chasing a quick ranked duel, plus a pinch of students using the timed practice arena to get faster under pressure.

## Product Purpose

Code Royale is a real-time competitive coding game. Two or more players take the same coding problem at the same time under one ticking clock; the first to pass all test cases wins the round. It makes practicing for competitive programming feel like a game: head-to-head speed, live stakes, leaderboards, and standings instead of solo drills.

## Positioning

The meaningfully different claim is the live, human opponent: you are racing an actual person on the same problem in real time, not chasing a scoreboard or a solo timer. On top of that head-to-head core sit the social battles (friends, clubs, bots, live presence) and the ranked loop (ELO, leagues, leaderboard, practice to get sharper). Social coding battles lead; the live 1v1 duel and a pinch of ladder-and-practice repeat the theme.

## Operating Context

- Web app (Next.js) with accounts and authentication; friends list with live presence; brawls, ranked and unranked matchmaking, friend invitations, and bot battles.
- A timed match flow: read the prompt, write the solution, submit before the clock runs out; first to pass the tests wins.
- Leaderboards, ELO ratings, clubs with roles and trophies, player profiles with badges and progress, a practice arena, and a tournament rules page.
- Runs with `bun`; Supabase backend; the practice arena has a code editor with split-pane layout.

## Capabilities and Constraints

- Ranked and unranked 1v1 matchmaking; friend matches with invitations; bot battles; practice arena; ELO and leaderboards; clubs (roles, trophies); friends list with live presence; profiles with badges; tournament rules.
- Free accounts, no paywall.
- Dark and light theming with a shared token set defined in `src/app/globals.css`.
- Terminology: "duel" (1v1), "brawl" (4-player), "arena", "Royale ladder", "matches", "trophies".

## Brand Commitments

- Name: **Code Royale** ("CR" wordmark).
- It is a **gaming platform about coding** — the look should read as a game: attractive, energetic, laden with game-like craft (competition, stakes, rank, trophies) rather than a plain dev tool or corporate SaaS.
- Voice: fast, sharp, sporty, playful-competitive — "duel", "brawl", "arena", "climb the ladder", "bragging rights", "the sharpest coder in the room".
- Keep the existing copy and terminology; present them in a more game-like shell.

## Evidence on Hand

- Full running implementation in `src/` (home, match, battle, practice with code editor, leaderboard, clubs, friends, profile, settings, team, tournaments, game modes, auth).
- Real copy throughout (hero, feature copy, match preview terminal, footer).
- USPs are real features in code; do not fabricate testimonials, benchmarks, or platform claims.

## Product Principles

- The live opponent is the point: every surface should reinforce head-to-head competition and speed under a clock.
- It is a game first, a coding tool second: energy, stakes, and escalation beat neutral utility, without sacrificing clarity or precision.
- Social battle and bragging rights drive retention: make dueling friends, clubs, and bots feel immediate and rewarding.
- Speed and getting sharper are the loop: progress, ranks, trophies, and the practice arena feed back into competing.
- Craft and code hygiene stay high: game-like energy must come from real layout, type, color, and motion — never from clutter.

## Accessibility & Inclusion

- Responsive across desktop and mobile; dark and light themes from the shared token set; focus rings and muted text reserved for descriptive/secondary copy. Keep contrast and keyboard affordances intact while adding game-like energy.