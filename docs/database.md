# Database

This document describes the database schema of Code Royale. The database is a Supabase Postgres database.

The file `supabase-single-source-reset.sql` is the source of truth for the schema. It drops and recreates all app tables. Run the SQL files in the order that the [setup guide](setup.md) gives.

## Tables

### users

The `users` table stores the app profiles. Each row has the same ID as a row in `auth.users`.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key. References `auth.users.id` |
| `username` | `text` | The display name of the user |
| `rating` | `int` | The ELO rating. The default is 0 |
| `wins` | `int` | The number of won matches |
| `losses` | `int` | The number of lost matches |
| `team_name` | `text` | The team name of the user |
| `created_at` | `timestamptz` | The creation time. The default is `now()` |
| `updated_at` | `timestamptz` | The last update time. The default is `now()` |

### connections

The `connections` table stores the friend relationships. A row connects two users. The status defines the relationship type.

| Column | Type | Notes |
| --- | --- | --- |
| `user_id` | `uuid` | Part of the primary key. References `auth.users.id` |
| `connection_id` | `uuid` | Part of the primary key. References `auth.users.id` |
| `status` | `text` | One of `pending`, `accepted`, `blocked` |
| `created_at` | `timestamptz` | The creation time |
| `updated_at` | `timestamptz` | The last update time |

The table has a check that `user_id` differs from `connection_id`. A user cannot connect to themselves.

### clubs

The `clubs` table stores the clubs.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key. The default is `gen_random_uuid()` |
| `name` | `text` | The club name. It is unique |
| `logo` | `text` | The logo of the club |
| `emblem` | `text` | The emblem of the club |
| `privacy` | `text` | One of `public`, `private`. The default is `public` |
| `max_members` | `int` | One of 10, 20, 30, 40. The default is 20 |
| `trophies` | `int` | The trophy count. The default is 0 |
| `owner_id` | `uuid` | References `auth.users.id` |
| `created_at` | `timestamptz` | The creation time |

### club_members

The `club_members` table stores the members of each club.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key. The default is `gen_random_uuid()` |
| `club_id` | `uuid` | References `clubs.id` |
| `user_id` | `uuid` | References `auth.users.id` |
| `role` | `text` | One of `host`, `elder`, `member`. The default is `member` |
| `trophies_contributed` | `int` | The trophies that the member contributed |
| `joined_at` | `timestamptz` | The join time |

The table has a unique constraint on `club_id` and `user_id`. It also has a unique constraint on `user_id`. A user can be a member of one club only.

### club_join_requests

The `club_join_requests` table stores the join requests for private clubs.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key. The default is `gen_random_uuid()` |
| `club_id` | `uuid` | References `clubs.id` |
| `user_id` | `uuid` | References `auth.users.id` |
| `status` | `text` | One of `pending`, `accepted`, `rejected`. The default is `pending` |
| `created_at` | `timestamptz` | The creation time |

The table has a unique constraint on `club_id` and `user_id`.

### player_stats

The `player_stats` table stores the per-mode statistics of each player.

| Column | Type | Notes |
| --- | --- | --- |
| `user_id` | `uuid` | Primary key. References `auth.users.id` |
| `username` | `text` | The display name. The default is `Player` |
| `avatar_url` | `text` | The avatar of the player |
| `trophies_1v1` | `int` | The trophies in 1v1 mode |
| `trophies_2v2` | `int` | The trophies in 2v2 mode |
| `wins_1v1` | `int` | The wins in 1v1 mode |
| `losses_1v1` | `int` | The losses in 1v1 mode |
| `wins_2v2` | `int` | The wins in 2v2 mode |
| `losses_2v2` | `int` | The losses in 2v2 mode |
| `matches_played` | `int` | The total matches played |
| `league` | `text` | One of `bronze`, `silver`, `gold`, `platinum`, `diamond`. The default is `bronze` |
| `updated_at` | `timestamptz` | The last update time |

The file `supabase-bot-battles.sql` adds these columns:

| Column | Type | Notes |
| --- | --- | --- |
| `bot_matches_played` | `int` | The bot battles played. The default is 0 |
| `bot_wins` | `int` | The bot battles won. The default is 0 |
| `bot_trophies` | `int` | The trophies from bot battles. The default is 0 |

### practice_questions

The `practice_questions` table stores the coding problems.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key. The default is `gen_random_uuid()` |
| `slug` | `text` | The URL slug. It is unique |
| `title` | `text` | The title of the question |
| `description` | `text` | The problem statement |
| `difficulty` | `text` | One of `easy`, `medium`, `hard` |
| `languages` | `text[]` | The allowed languages |
| `testcases` | `jsonb` | The test cases as an array of objects |
| `meta` | `jsonb` | The metadata with complexity and topics |
| `created_at` | `timestamptz` | The creation time |

### practice_testcases

The `practice_testcases` table is the legacy fallback for test cases. The app uses it when `practice_questions.testcases` is empty.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `bigint` | Primary key. Generated as identity |
| `question_id` | `uuid` | References `practice_questions.id` |
| `stdin` | `text` | The input for the test case |
| `expected_output` | `text` | The expected output |
| `hidden` | `boolean` | The visibility of the test case. The default is `true` |

### matches

The `matches` table stores the matches. The `metadata` column holds the match state.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key. The default is `gen_random_uuid()` |
| `mode` | `text` | One of `ranked`, `unranked`. The default is `ranked` |
| `metadata` | `jsonb` | The match state. The default is `{}` |
| `created_at` | `timestamptz` | The creation time |

The metadata uses these keys:

- `question_id` — the ID of the question
- `question_difficulty` — the difficulty of the question
- `time_limit` — the time limit in seconds
- `language` — the allowed language
- `match_type` — one of `1v1`, `2v2`, `ffa`
- `trophy_multiplier` — the trophy multiplier for the match
- `started_at` — the start time
- `winner_id` — the ID of the winner
- `loser_id` — the ID of the loser
- `completed_at` — the completion time
- `rating_delta` — the rating change for the winner and the loser
- `forfeit` — true when the match ended with a forfeit
- `timed_out` — true when the match ended with a timeout
- `friend_invite` — the inviter ID and the invitee ID for friend matches

### match_players

The `match_players` table stores the participants of each match.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key. The default is `gen_random_uuid()` |
| `match_id` | `uuid` | References `matches.id` |
| `user_id` | `uuid` | References `auth.users.id` |
| `created_at` | `timestamptz` | The creation time |

The table has a unique constraint on `match_id` and `user_id`.

### matchmaking_queue

The `matchmaking_queue` table stores the users who wait for an opponent.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key. The default is `gen_random_uuid()` |
| `user_id` | `uuid` | References `auth.users.id` |
| `mode` | `text` | One of `ranked`, `unranked`. The default is `ranked` |
| `created_at` | `timestamptz` | The creation time |

### practice_submissions

The `practice_submissions` table stores the practice results of each user.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key. The default is `gen_random_uuid()` |
| `user_id` | `uuid` | References `auth.users.id` |
| `question_id` | `uuid` | References `practice_questions.id` |
| `language` | `text` | The language of the submission |
| `passed` | `boolean` | The pass state. The default is `false` |
| `created_at` | `timestamptz` | The creation time |

### badges

The `badges` table stores the achievements. The file `supabase-badges.sql` creates it.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key. The default is `gen_random_uuid()` |
| `name` | `text` | The badge name. It is unique |
| `description` | `text` | The badge description |
| `icon` | `text` | The badge icon |
| `created_at` | `timestamptz` | The creation time |

The script inserts five default badges:

- First Blood
- 10-Day Streak
- DSA Master
- Social Butterfly
- Early Adopter

### user_badges

The `user_badges` table connects users to badges.

| Column | Type | Notes |
| --- | --- | --- |
| `user_id` | `uuid` | Part of the primary key. References `users.id` |
| `badge_id` | `uuid` | Part of the primary key. References `badges.id` |
| `awarded_at` | `timestamptz` | The award time |

## Functions

The reset script creates these functions:

- `set_updated_at()` — sets `updated_at` to `now()` before an update
- `handle_new_user_profile()` — creates a `users` row when a new auth user signs up. It uses the display name or the email prefix as the username
- `get_club_member_count(club_id)` — returns the member count of a club

## Triggers

The reset script creates these triggers:

- `users_set_updated_at` — runs `set_updated_at()` before an update on `users`
- `connections_set_updated_at` — runs `set_updated_at()` before an update on `connections`
- `on_auth_user_created_profile` — runs `handle_new_user_profile()` after an insert on `auth.users`

## Indexes

The reset script creates these indexes:

- `connections_user_idx` on `connections(user_id)`
- `connections_connection_idx` on `connections(connection_id)`
- `connections_status_idx` on `connections(status)`
- `idx_clubs_trophies` on `clubs(trophies desc)`
- `idx_club_members_user` on `club_members(user_id)`
- `idx_club_members_club` on `club_members(club_id)`
- `idx_join_requests_club` on `club_join_requests(club_id)`
- `idx_join_requests_user` on `club_join_requests(user_id)`
- `idx_player_stats_1v1` on `player_stats(trophies_1v1 desc)`
- `idx_player_stats_2v2` on `player_stats(trophies_2v2 desc)`
- `idx_player_stats_league_1v1` on `player_stats(league, trophies_1v1 desc)`
- `idx_practice_questions_difficulty` on `practice_questions(difficulty)`
- `idx_practice_questions_slug` on `practice_questions(slug)`
- `idx_matchmaking_queue_mode` on `matchmaking_queue(mode, created_at)`
- `idx_practice_submissions_user_created` on `practice_submissions(user_id, created_at desc)`
- `idx_practice_submissions_user_question_passed` on `practice_submissions(user_id, question_id, passed)`

## Row Level Security

All tables have row level security enabled. The policies below define the access rules.

- `users` — all authenticated users can select. A user can insert and update their own row
- `connections` — a user can select the rows where they are the sender or the receiver. A user can insert a pending row as the sender. The receiver can accept or block a pending row. A user can delete the rows where they are the sender or the receiver
- `clubs` — everyone can select. The owner can insert, update, and delete
- `club_members` — everyone can select. A user can insert and delete their own membership
- `club_join_requests` — the requester and the club owner can select. A user can insert their own request. The club owner can update
- `player_stats` — everyone can select. A user can insert and update their own row
- `practice_questions` — everyone can select
- `practice_testcases` — everyone can select
- `practice_submissions` — a user can select and insert their own rows
- `matchmaking_queue` — a user can select, insert, and delete their own rows
- `match_players` — a user can select their own rows. Only the service role can insert
- `matches` — a participant can select. Only the service role can insert

The service-role client bypasses row level security. The server routes use it for operations that the policies do not allow.

## SQL files

The `frontend` folder contains these SQL files:

- `supabase-single-source-reset.sql` — the reset and rebuild script. It is the source of truth
- `supabase-clubs-leaderboard.sql` — the older incremental script for clubs, leaderboards, practice, and matchmaking tables
- `supabase-bot-battles.sql` — adds the bot battle columns to `player_stats`
- `supabase-badges.sql` — creates the badges tables and inserts the default badges
- `supabase-extra-dsa-daa-questions.sql` — adds 30 extra questions to `practice_questions`
