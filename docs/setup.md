# Setup guide

This document explains how to configure and run Code Royale.

## Prerequisites

Install these tools before you start:

- bun
- A Supabase project
- A code execution service (Judge0 is the default)

## Environment variables

The app reads its configuration from environment variables. Create the file `frontend/.env.local` and add the variables below.

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | The URL of your Supabase project |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | The public anon key of your Supabase project |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | The service role key for server operations |
| `NEXT_PUBLIC_SITE_URL` | No | The deployed domain for confirmation email links |
| `JUDGE0_BASE_URL` | No | The base URL of the Judge0 instance. The default is `https://ce.judge0.com` |
| `JUDGE0_API_KEY` | No | The API key for the RapidAPI Judge0 instance |
| `JUDGE0_API_HOST` | No | The API host for the RapidAPI Judge0 instance. The default is `judge0-ce.p.rapidapi.com` |

Note: `NEXT_PUBLIC_SUPABASE_ANON_KEY` must be a real key. The browser client rejects placeholder values that contain `YOUR_`.

## Install the dependencies

Run this command in the `frontend` folder:

```bash
bun install
```

## Configure the database

Run the SQL files in the Supabase SQL editor. Use this order:

1. `supabase-single-source-reset.sql` — creates all tables, functions, triggers, and policies
2. `supabase-bot-battles.sql` — adds the bot battle columns
3. `supabase-badges.sql` — creates the badges tables and the default badges
4. `supabase-extra-dsa-daa-questions.sql` — adds 30 extra questions

CAUTION: `supabase-single-source-reset.sql` drops and recreates the app tables. It deletes all app data. It does not touch the `auth.users` table.

The file `supabase-clubs-leaderboard.sql` is an older incremental script. Do not run it after the reset script.

## Seed the questions

Run the seed scripts from the `frontend` folder:

```bash
bun run seed:pvp
bun scripts/seed-extra-questions.mjs
```

The script `seed:pvp` reads `frontend/.env.local` and inserts 50 curated questions into `practice_questions`. The script `seed-extra-questions.mjs` inserts 30 extra questions.

## Run the app

Start the development server with this command:

```bash
bun dev
```

Open `http://localhost:3000` in your browser.

Use these commands for the other tasks:

- `bun run build` — build the app for production
- `bun start` — start the production server
- `bun lint` — run the ESLint checks

## GitHub sign-in

The app supports sign-in with GitHub. Supabase manages the OAuth flow. Configure it with these steps before you start:

1. Create a GitHub App (recommended) or an OAuth App.
   - Open `https://github.com/settings/developers`.
   - Register a new application.
   - Enter the Homepage URL. Use the origin of your app. For example, use `http://localhost:3000` when you run the app locally.
   - Enter the callback URL. Use `https://<project-ref>.supabase.co/auth/v1/callback`. Replace `<project-ref>` with the reference of your Supabase project.
   - Save the client ID and the client secret.
2. Enable the GitHub provider in the Supabase dashboard.
   - Open Authentication > Sign In / Providers.
   - Turn on the GitHub provider.
   - Enter the client ID and the client secret from step 1.
   - Save the settings.
3. Apply the username fallback function.
   - Run `supabase-github-username.sql` in the Supabase SQL editor.
   - The function reads the GitHub login from the OAuth metadata when a user signs up.

When a user signs in with GitHub for the first time, the app creates a profile row. The username comes from the GitHub login. A new user needs no extra setup.

## Code execution

The app sends code to Judge0 to run it. The default instance is the public instance at `https://ce.judge0.com`. It has no API key.

To use the RapidAPI instance, set these variables:

- `JUDGE0_API_KEY`
- `JUDGE0_BASE_URL`
- `JUDGE0_API_HOST`

The supported languages are JavaScript (Node.js), Python, C++, Java, and C. The server resolves the Judge0 language ID by name. It falls back to a fixed ID when the name lookup fails.
