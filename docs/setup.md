# Setup guide

This document explains how to configure and run Code Royale.

## Prerequisites

Install these tools before you start:

- bun
- A Supabase project
- A self-hosted goboxd code execution service (required)

## Environment variables

The app reads its configuration from environment variables. Create the file `frontend/.env.local` and add the variables below.

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | The URL of your Supabase project |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | The public anon key of your Supabase project |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | The service role key for server operations |
| `NEXT_PUBLIC_SITE_URL` | No | The deployed domain for confirmation email links |
| `GOBOXD_API_URL` | Yes | The base URL of the self-hosted goboxd code execution service. The app returns `502` at submission time when this is missing |

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
4. `supabase-github-username.sql` — adds the GitHub username fallback function (optional, for GitHub sign-in)

CAUTION: `supabase-single-source-reset.sql` drops and recreates the app tables. It deletes all app data. It does not touch the `auth.users` table.

## Seed the questions

Run the seed script from the `frontend` folder:

```bash
bun run seed:practice
```

The script reads `frontend/.env.local`, clears `practice_questions`, and inserts the curated quality problem bank (easy, medium, and hard problems with LeetCode-style function signatures).

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
4. Configure the URL settings.
   - Open Authentication > URL Configuration.
   - Set the Site URL to the origin of your deployed app. For example, set it to `https://code-royale-gilt.vercel.app`.
   - Add the origin of your deployed app to the Redirect URLs. Use this format: `https://code-royale-gilt.vercel.app/**`.
   - Add `http://localhost:3000/**` to the Redirect URLs when you develop locally.
   - Set `NEXT_PUBLIC_SITE_URL` in your hosting environment to the deployed origin. For example, set it to `https://code-royale-gilt.vercel.app` in the Vercel project settings.
   - Redeploy the app after you change `NEXT_PUBLIC_SITE_URL`.

When a user signs in with GitHub for the first time, the app creates a profile row. The username comes from the GitHub login. A new user needs no extra setup.

If the sign-in redirects to `http://localhost:3000` after authorization, check the URL Configuration. The redirect target must be in the Redirect URLs list. A redirect to localhost usually means that the deployed origin is missing from the list.

## Code execution

The app sends code to a **self-hosted goboxd** server to run it. goboxd is a
hardened sandbox (nsjail + seccomp + cgroups) that compiles and runs untrusted
code and judges it against the question's test cases.

Set the `GOBOXD_API_URL` variable to the base URL of your goboxd server. It is
required; submissions fail with `502` when it is missing.

- `GOBOXD_API_URL`

The supported languages are JavaScript (Node.js), Python, C++, Java, and C.
The server maps these to goboxd's registry IDs: `javascript`/`node` → `js`,
`python` → `py3`, `cpp` → `cpp`, `java` → `java`, `c` → `c`. Judging is strict
and byte-exact: a test passes only when stdout exactly matches the expected
output. `output_whitespace_mismatch` (identical after trimming whitespace) and
`wrong_output` both count as failures.
