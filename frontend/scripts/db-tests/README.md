# Database tests for friend connections

This folder holds a transactional test suite for the friend-connection flows.

## What the suite checks

The suite tests the RLS behavior of the `connections` table. It simulates real
authenticated users. It creates sandbox rows, asserts the expected behavior,
and rolls back. It never commits data.

The suite covers these flows:

- T1: a sender creates a pending request.
- T2: a receiver accepts the request (pending becomes accepted).
- T3: a receiver declines the request (the row is deleted).
- T4: a sender cancels an outgoing request (the row is deleted).
- T5: a stranger cannot update, delete, or see another user's edge.
- T6: a blocked party cannot un-block themselves.

## How to run

You need a Postgres connection string with full access to the project database.

Run the suite with psql:

```
psql "<DATABASE_URL>" -v ON_ERROR_STOP=1 -f connections-rls.sql
```

Set `DATABASE_URL` to the project database connection string. Do not point it
at production data unless you accept the risk. The suite rolls back, but it
still connects to the target database.

The exit code is 0 when all tests pass. The exit code is non-zero when a test
fails. A failing test prints an exception that names the test.

You can also run this file with the Supabase MCP `execute_sql` tool against
the remote project.

## Existing data

The suite's sandbox id pairs must NOT already exist as real edges in the target
database. A `connections` row is identified by `(user_id, connection_id)`, which
is the primary key. If a pair already exists, the suite's `INSERT` hits the
`UNIQUE (user_id, connection_id)` constraint and fails loudly with a unique
violation (a safe failure). The pairs are listed in the SQL file header and can
be changed there.

## Test identities

The suite uses existing user ids. Each id must exist in both `public.users`
and `auth.users`. The file header lists the ids. Update them if the test users
change.
