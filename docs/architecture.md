# Architecture

This document describes the architecture of Code Royale. It covers the tech stack, the codebase layout, and the main data flows.

## Tech stack

The app uses these technologies:

- Next.js 16 with the App Router and Turbopack
- React 19
- TypeScript 5
- Tailwind CSS 4
- Supabase for the database, authentication, and realtime features
- Judge0 for code execution
- bun as the package manager

## High-level architecture

The app has two parts:

- The client (the browser)
- The server (the Next.js API routes)

The client connects to Supabase for authentication, data, and realtime features. The client sends code submissions to the server. The server runs the code on Judge0 and returns the result.

The diagram below shows the main connections:

```
Browser (Next.js client)
    |
    |-- Supabase Auth
    |-- Supabase Database
    |-- Supabase Realtime
    |
    |-- Next.js API routes
            |
            |-- Judge0 (code execution)
```

## Codebase layout

The application code is in the `frontend` folder. The source code is in `frontend/src`.

### Pages

The pages are in `frontend/src/app`. Each page is a folder with a `page.tsx` file.

| Route | File | Purpose |
| --- | --- | --- |
| `/` | `src/app/page.tsx` | Public landing page |
| `/home` | `src/app/home/page.tsx` | Dashboard for signed-in users |
| `/game-modes` | `src/app/game-modes/page.tsx` | Game mode hub with matchmaking, friend invites, bot battles, and practice |
| `/auth/login` | `src/app/auth/login/page.tsx` | Sign-in form |
| `/auth/signup` | `src/app/auth/signup/page.tsx` | Account creation form |
| `/practice` | `src/app/practice/page.tsx` | Practice arena lobby with the question list |
| `/practice/[slug]` | `src/app/practice/[slug]/page.tsx` | Practice session for one question |
| `/bot-battle` | `src/app/bot-battle/page.tsx` | Bot battle arena |
| `/match/[matchId]` | `src/app/match/[matchId]/page.tsx` | Live 1v1 match arena |
| `/leaderboard` | `src/app/leaderboard/page.tsx` | Player rankings by rating |
| `/clubs` | `src/app/clubs/page.tsx` | Club list and the user club |
| `/clubs/[clubId]` | `src/app/clubs/[clubId]/page.tsx` | Club detail page |
| `/friends` | `src/app/friends/page.tsx` | Friend list, requests, and presence |
| `/profile` | `src/app/profile/page.tsx` | Player profile with stats, badges, and activity |
| `/settings` | `src/app/settings/page.tsx` | Profile, theme, privacy, and security settings |
| `/team` | `src/app/team/page.tsx` | Call to action to join a club |
| `/tournaments` | `src/app/tournaments/page.tsx` | Tournament rules page |

The app also has these files:

- `src/app/layout.tsx` — the root layout with fonts and metadata
- `src/app/globals.css` — the global styles and theme variables
- `src/app/favicon.ico` — the site icon

The client-side page logic is in separate files:

- `src/app/home/home-nav.tsx` — the navigation for the dashboard
- `src/app/practice/practice-lobby.tsx` — the question list for the practice lobby
- `src/app/practice/practice-scaffold.tsx` — the layout scaffold for practice pages
- `src/app/practice/[slug]/practice-arena-shell.tsx` — the practice editor and submit flow
- `src/app/bot-battle/bot-arena-client.tsx` — the bot battle client logic
- `src/app/match/[matchId]/match-arena-shell.tsx` — the match arena client logic

### API routes

The API routes are in `frontend/src/app/api`. Each route is a folder with a `route.ts` file. See the [API reference](api.md) for the details.

| Route | File |
| --- | --- |
| `POST /api/bot-battle/start` | `src/app/api/bot-battle/start/route.ts` |
| `POST /api/bot-battle/complete` | `src/app/api/bot-battle/complete/route.ts` |
| `POST /api/clubs/create` | `src/app/api/clubs/create/route.ts` |
| `POST /api/clubs/join` | `src/app/api/clubs/join/route.ts` |
| `POST /api/clubs/leave` | `src/app/api/clubs/leave/route.ts` |
| `GET /api/clubs/list` | `src/app/api/clubs/list/route.ts` |
| `POST /api/friend-match/create` | `src/app/api/friend-match/create/route.ts` |
| `POST /api/friend-match/start` | `src/app/api/friend-match/start/route.ts` |
| `POST /api/friends/manage` | `src/app/api/friends/manage/route.ts` |
| `GET /api/friends/meta` | `src/app/api/friends/meta/route.ts` |
| `POST /api/match/complete` | `src/app/api/match/complete/route.ts` |
| `POST /api/match/forfeit` | `src/app/api/match/forfeit/route.ts` |
| `POST /api/match/timeout` | `src/app/api/match/timeout/route.ts` |
| `POST /api/matchmaking/cancel` | `src/app/api/matchmaking/cancel/route.ts` |
| `POST /api/matchmaking/join` | `src/app/api/matchmaking/join/route.ts` |
| `GET /api/matchmaking/status` | `src/app/api/matchmaking/status/route.ts` |
| `GET /api/practice/questions` | `src/app/api/practice/questions/route.ts` |
| `POST /api/practice/submit` | `src/app/api/practice/submit/route.ts` |
| `GET /api/profile/progress` | `src/app/api/profile/progress/route.ts` |
| `POST /api/profile/progress/reset` | `src/app/api/profile/progress/reset/route.ts` |
| `GET /api/telemetry/summary` | `src/app/api/telemetry/summary/route.ts` |

### Components

The shared components are in `frontend/src/components`:

- `app-shell.tsx` — the shell for signed-in pages with the main navigation
- `navigation.tsx` — the navigation for public pages
- `glow-card.tsx` — a card with a glow effect
- `neon-button.tsx` — a neon-styled button
- `theme-sync.tsx` — the theme synchronization for the client
- `practice-arena-leetcode.tsx` — the LeetCode-style practice editor
- `battle/opponent-activity-panel.tsx` — the opponent activity panel for matches
- `battle/tetrio-battle-background.tsx` — the animated battle background

### Library modules

The library modules are in `frontend/src/lib`:

- `supabase.ts` — the Supabase server client that uses cookies
- `supabase-browser.ts` — the Supabase browser client with configuration validation
- `supabase-service.ts` — the Supabase service-role client for server operations
- `oauth.ts` — the shared OAuth helpers for the redirect target and error messages
- `bot-player.ts` — the bot simulator for bot battles
- `pvp-questions.ts` — the curated PvP question seeds
- `use-friend-presence.ts` — the hook for live friend presence

### Proxy

The file `frontend/src/proxy.ts` is the session proxy. It refreshes the Supabase session for each request. It excludes static assets from its matcher.

### Scripts

The scripts are in `frontend/scripts`:

- `seed-pvp-questions.mjs` — seeds the curated PvP questions
- `seed-extra-questions.mjs` — seeds 30 extra DSA and DAA questions

### SQL files

The SQL files are in the `frontend` folder. They define the database schema. See the [database document](database.md) for the details.

### Configuration files

The configuration files are in the `frontend` folder:

- `package.json` — the dependencies and the npm scripts
- `bun.lock` — the locked dependency versions
- `next.config.ts` — the Next.js configuration
- `tsconfig.json` — the TypeScript configuration with the `@/*` path alias
- `eslint.config.mjs` — the ESLint configuration
- `postcss.config.mjs` — the PostCSS configuration for Tailwind CSS
- `.gitignore` — the ignored files

The `public` folder contains the static assets. It has the logo files and the images that the pages use.

## Main data flows

### Matchmaking flow

1. The client sends a request to `POST /api/matchmaking/join`.
2. The server adds the user to the `matchmaking_queue` table.
3. The server polls the queue for 60 seconds.
4. The server finds an opponent and creates a match.
5. The server adds both players to the `match_players` table.
6. The server removes both players from the queue.
7. The server returns the match ID to the client.

### Match completion flow

1. The client sends a request to `POST /api/match/complete`.
2. The server checks the match participants.
3. The server calculates the ELO rating change for ranked matches.
4. The server updates the player ratings, wins, and losses.
5. The server stores the result in the match metadata.
6. The server returns the result to the client.

### Practice submit flow

1. The client sends a request to `POST /api/practice/submit`.
2. The server loads the question and its test cases.
3. The server sends the code to Judge0 for each test case.
4. The server compares the output with the expected output.
5. The server stops at the first failed test case.
6. The server records a submission when all test cases pass.
7. The server returns the results to the client.

### Bot battle flow

1. The client sends a request to `POST /api/bot-battle/start`.
2. The server returns a random question for the difficulty.
3. The client runs the battle against the bot simulator.
4. The client sends a request to `POST /api/bot-battle/complete`.
5. The server updates the bot battle stats and trophies.
6. The server returns the awarded points to the client.

### Telemetry flow

1. The client requests `GET /api/telemetry/summary`.
2. The server reads or creates the `cr_vid` cookie.
3. The server updates the in-memory visit state.
4. The server counts the active players and the matches today.
5. The server returns the summary to the client.
