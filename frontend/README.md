# Code Royale frontend

This folder contains the Code Royale application. The application is a Next.js 16 app with Supabase and Judge0.

## Quick start

Run these commands in this folder:

```bash
bun install
bun dev
```

Before you run the app, create the file `.env.local` with the Supabase variables. See the [setup guide](../docs/setup.md) for the full instructions.

Open `http://localhost:3000` in your browser.

## Seed the questions

Run this command to insert the curated questions:

```bash
bun run seed:pvp
```

The seed script reads the `.env.local` file. The `SUPABASE_SERVICE_ROLE_KEY` value must be present.

## Scripts

The `package.json` file defines these scripts:

- `bun dev` — start the development server
- `bun run build` — build the app for production
- `bun start` — start the production server
- `bun lint` — run the ESLint checks
- `bun run seed:pvp` — seed the PvP questions

## Documentation

Read the project documentation in the `docs` folder at the repository root:

- [Architecture](../docs/architecture.md)
- [Setup guide](../docs/setup.md)
- [Database](../docs/database.md)
- [API reference](../docs/api.md)
