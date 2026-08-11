# API reference

This document describes all the API routes of Code Royale. The routes are in `frontend/src/app/api`.

## Conventions

The API routes have these conventions:

- The base URL is the app origin. An example is `https://code-royale.app`
- The routes return JSON
- The routes use the session cookie for authentication
- The routes return an error object in this form: `{ "error": "message" }`
- The status codes are 400, 401, 403, 404, 500, and 502

The status codes have these meanings:

- `400` — the request body or the parameters are invalid
- `401` — the user is not authenticated
- `403` — the user cannot do the action
- `404` — the resource does not exist
- `500` — the server cannot complete the action
- `502` — the code execution service is not available

## Route list

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/api/bot-battle/start` | Start a bot battle |
| POST | `/api/bot-battle/complete` | Complete a bot battle |
| POST | `/api/clubs/create` | Create a club |
| POST | `/api/clubs/join` | Join a club |
| POST | `/api/clubs/leave` | Leave a club |
| GET | `/api/clubs/list` | List clubs |
| POST | `/api/friend-match/create` | Create a friend match |
| POST | `/api/friend-match/start` | Start a friend match |
| POST | `/api/friends/manage` | Block or unblock a user |
| GET | `/api/friends/meta` | Get friend counts |
| POST | `/api/match/complete` | Complete a match |
| POST | `/api/match/forfeit` | Forfeit a match |
| POST | `/api/match/timeout` | Resolve a timed-out match |
| POST | `/api/matchmaking/cancel` | Cancel matchmaking |
| POST | `/api/matchmaking/join` | Join matchmaking |
| GET | `/api/matchmaking/status` | Get the matchmaking status |
| GET | `/api/practice/questions` | List practice questions |
| POST | `/api/practice/submit` | Submit code for a question |
| GET | `/api/profile/progress` | Get the profile progress |
| POST | `/api/profile/progress/reset` | Reset the profile progress |
| GET | `/api/telemetry/summary` | Get the telemetry summary |

## Bot battle routes

### POST /api/bot-battle/start

This route returns a random question for a bot battle.

Request body:

```json
{
  "difficulty": "easy"
}
```

The `difficulty` field is optional. The values are `easy`, `medium`, and `hard`. The default is `easy`.

The route picks a random question from the requested difficulty. When the difficulty bucket is empty, it picks a random question from all difficulties.

Success response (200):

```json
{
  "question": {
    "id": "uuid",
    "slug": "string",
    "title": "string",
    "description": "string",
    "difficulty": "easy",
    "languages": ["javascript", "python"],
    "testcases": []
  },
  "difficulty": "easy"
}
```

Errors: `401`, `500` when no questions exist.

### POST /api/bot-battle/complete

This route records the result of a bot battle and awards points.

Request body:

```json
{
  "difficulty": "hard",
  "won": true,
  "timeTakenSeconds": 240
}
```

The points come from a configuration table:

| Difficulty | Base | Bonus | Multiplier |
| --- | --- | --- | --- |
| easy | 50 | 30 | 1 |
| medium | 100 | 50 | 2 |
| hard | 150 | 100 | 3 |

The base points are `base * multiplier`. The bonus points are `bonus * multiplier` when the player wins. The route adds the bonus to the base.

The route updates `player_stats`. When the player has no row, the route creates one with default values.

Success response (200):

```json
{
  "pointsAwarded": 450,
  "won": true,
  "difficulty": "hard",
  "timeTakenSeconds": 240,
  "breakdown": {
    "base": 150,
    "multiplier": 3,
    "bonus": 300
  }
}
```

Errors: `400`, `401`, `500`.

Note: this route does not change `users.rating`. The rating field tracks PvP ELO only.

## Club routes

### POST /api/clubs/create

This route creates a club and adds the creator as the host.

Request body:

```json
{
  "name": "string",
  "userId": "uuid",
  "logo": "string",
  "emblem": "string",
  "privacy": "public",
  "maxMembers": 20
}
```

The route requires the `name` and `userId` fields. The other fields are optional. The defaults are the logo `⚔️`, the emblem `sword`, the privacy `public`, and the max members 20.

The route returns `400` when the user is already a member of a club.

Success response (200):

```json
{
  "club": {
    "id": "uuid",
    "name": "string",
    "logo": "⚔️",
    "emblem": "sword",
    "privacy": "public",
    "max_members": 20,
    "trophies": 0,
    "owner_id": "uuid",
    "created_at": "timestamp"
  }
}
```

Errors: `400`, `500`.

Note: this route takes the user ID from the request body. It does not check the session.

### POST /api/clubs/join

This route joins a public club or sends a request to join a private club.

Request body:

```json
{
  "clubId": "uuid",
  "userId": "uuid"
}
```

The route returns `400` when the user is already a member of a club. It returns `404` when the club does not exist. It returns `400` when the club is full.

For a private club, the route inserts a row into `club_join_requests`. The response is `{ "status": "request_sent" }`.

For a public club, the route inserts a membership row. The response is `{ "status": "joined", "club": { ... } }`.

Errors: `400`, `404`, `500`.

Note: this route takes the user ID from the request body. It does not check the session.

### POST /api/clubs/leave

This route removes a user from their club.

Request body:

```json
{
  "userId": "uuid"
}
```

The route returns `400` when the user is not a member of a club.

When the host leaves and other members exist, the route transfers the host role to the oldest member. When no other members exist, the route deletes the club.

Success response (200):

```json
{
  "status": "left"
}
```

Errors: `400`, `500`.

Note: this route takes the user ID from the request body. It does not check the session.

### GET /api/clubs/list

This route lists clubs with their member counts and top players.

Query parameters:

| Parameter | Purpose |
| --- | --- |
| `search` | Filters the clubs by name. The match is case-insensitive |
| `userId` | Adds the `myClub` field for this user |

The route returns up to 50 clubs. It sorts them by trophies in descending order.

Success response (200):

```json
{
  "clubs": [
    {
      "id": "uuid",
      "name": "string",
      "memberCount": 5,
      "topPlayers": [
        {
          "id": "uuid",
          "username": "string",
          "avatar": "ST",
          "trophies": 100,
          "role": "host"
        }
      ]
    }
  ],
  "myClub": null
}
```

The `topPlayers` field holds the top 3 members by contributed trophies. The `avatar` field is the first two letters of the username in uppercase. The `myClub` field is the club of the user. It is `null` when the user is not in a club.

Errors: `500`.

## Friend match routes

### POST /api/friend-match/create

This route creates an unranked match between two friends.

Request body:

```json
{
  "friendUserId": "uuid",
  "timeLimitSeconds": 600,
  "language": "python",
  "difficulty": "medium"
}
```

The route requires the `friendUserId` field. It returns `400` when the user invites themselves.

The time limit defaults to 600 seconds. The valid range is 60 to 3600 seconds.

The difficulty has this default logic when the `difficulty` field is not set:

- 120 seconds or less — `easy`
- 121 to 300 seconds — `medium`
- 301 seconds or more — `hard`

The value `mixed` picks a question from all difficulties.

The route picks a random question and creates a match with mode `unranked`. The metadata stores the question, the time limit, the language, and the friend invite. The `started_at` value stays `null` until a player starts the match.

Success response (200):

```json
{
  "matchId": "uuid"
}
```

Errors: `400`, `401`, `500`.

### POST /api/friend-match/start

This route starts a friend match. It sets the `started_at` value in the match metadata.

Request body:

```json
{
  "matchId": "uuid"
}
```

The route returns `403` when the user is not a participant. It returns `404` when the match does not exist.

The route is idempotent. When the match has already started, it returns the existing start time.

Success response (200):

```json
{
  "ok": true,
  "startedAt": "timestamp"
}
```

Errors: `400`, `401`, `403`, `404`, `500`.

## Friend routes

### POST /api/friends/manage

This route blocks or unblocks a user.

Request body:

```json
{
  "action": "block",
  "targetUserId": "uuid"
}
```

The `action` values are `block` and `unblock`.

The route returns `400` when the target is the current user. When the action is `block`, the route deletes any connection between the two users and inserts a row with status `blocked`.

Success response (200):

```json
{
  "ok": true,
  "relationship": "blocked"
}
```

Errors: `400`, `401`, `500`.

### GET /api/friends/meta

This route returns the accepted friend count for each requested user.

Query parameters:

| Parameter | Purpose |
| --- | --- |
| `userIds` | A comma-separated list of user IDs. The maximum is 100 IDs |

The route counts the accepted connections in both directions. It returns 0 for each user without connections.

Success response (200):

```json
{
  "counts": {
    "uuid-1": 3,
    "uuid-2": 1
  }
}
```

Errors: `401`, `500`.

## Match routes

The match routes share the same structure. The request body has a `matchId` field. The routes check that the user is a participant in the match. When the match is already complete, the routes return the stored winner.

### POST /api/match/complete

This route completes a match with a winner.

Request body:

```json
{
  "matchId": "uuid"
}
```

The route performs these actions:

1. Check the match participants
2. Load the ratings of both players
3. Calculate the ELO rating change for ranked matches
4. Update the winner rating and wins
5. Update the loser rating and losses
6. Store the result in the match metadata

The ELO calculation uses a K-factor of 32. The winner gains at least 8 points. The loser loses at most 8 points. The ratings never go below 0. Unranked matches do not change ratings.

Success response (200):

```json
{
  "ok": true,
  "winnerId": "uuid",
  "loserId": "uuid",
  "mode": "ranked",
  "rating": {
    "winner": 1208,
    "loser": 1192
  },
  "ratingDelta": {
    "winner": 8,
    "loser": -8
  }
}
```

The response has the `alreadyCompleted` field set to `true` when the match is already complete.

Errors: `400`, `401`, `403`, `404`, `500`.

### POST /api/match/forfeit

This route completes a match as a forfeit. The forfeiting player loses.

Request body:

```json
{
  "matchId": "uuid"
}
```

The route performs the same ELO calculation as the complete route. The metadata stores `forfeit: true`.

Success response (200): same shape as `/api/match/complete`, but the winner is the opponent.

Errors: `400`, `401`, `403`, `404`, `500`.

### POST /api/match/timeout

This route resolves a match when the time runs out.

Request body:

```json
{
  "matchId": "uuid"
}
```

The route checks the `practice_submissions` table for the question of the match. When exactly one player solved the question, that player wins. When both or neither player solved it, the match is a draw. A draw does not change ratings.

The metadata stores `timed_out: true`.

Success response (200):

```json
{
  "ok": true,
  "winnerId": "uuid",
  "loserId": "uuid",
  "draw": false,
  "mode": "ranked",
  "ratingDelta": {
    "winner": 8,
    "loser": -8
  }
}
```

The `winnerId` and `loserId` fields are `null` for a draw. The `draw` field is `true`.

Errors: `400`, `401`, `404`, `500`.

## Matchmaking routes

### POST /api/matchmaking/join

This route adds the user to the matchmaking queue and searches for an opponent.

Request body:

```json
{
  "mode": "ranked",
  "timeLimitSeconds": 480,
  "language": "python",
  "matchType": "1v1",
  "difficulty": "mixed"
}
```

The defaults are:

- `mode` — `ranked`
- `timeLimitSeconds` — 480 seconds. The valid range is 60 to 3600 seconds
- `language` — no language restriction
- `matchType` — `1v1`. The route accepts the values `2v2` and `ffa`
- `difficulty` — used for ranked matches only. The route ignores this field for matchmaking

The route deletes any existing queue entry for the user and inserts a new one. It polls the queue every 2 seconds for up to 60 seconds.

For ranked matches, the route derives the question difficulty from the average rating of both players:

| Average rating | Difficulty |
| --- | --- |
| below 300 | easy |
| 300 to 699 | medium |
| 700 or more | hard |

Unranked matches use all difficulties. When the difficulty bucket is empty, the route falls back to all difficulties.

When the route finds an opponent, it creates a match. The metadata stores the question, the time limit, the language, and the match type. The `trophy_multiplier` is 1.5 for a time limit of 3600 seconds. The route removes both players from the queue.

Success response (200) when the route finds an opponent:

```json
{
  "matchId": "uuid"
}
```

Success response (200) when the search times out:

```json
{
  "status": "queued"
}
```

The route removes the user from the queue before it returns `queued`.

Errors: `400`, `401`, `500`.

### POST /api/matchmaking/cancel

This route removes the user from the matchmaking queue.

Success response (200):

```json
{
  "ok": true
}
```

Errors: `401`, `500`.

### GET /api/matchmaking/status

This route returns the most recent match of the user from the last 3 minutes.

Success response (200):

```json
{
  "matchId": "uuid"
}
```

The `matchId` field is `null` when the user has no recent match.

Errors: `401`.

## Practice routes

### GET /api/practice/questions

This route lists the practice questions.

Query parameters:

| Parameter | Purpose |
| --- | --- |
| `difficulty` | Filters by difficulty. The values are `easy`, `medium`, and `hard` |

Success response (200):

```json
{
  "questions": [
    {
      "id": "uuid",
      "title": "string",
      "slug": "string",
      "difficulty": "easy"
    }
  ]
}
```

The route sorts the questions by title in ascending order.

Errors: `500`.

### POST /api/practice/submit

This route runs user code against the test cases of a question.

Request body:

```json
{
  "questionId": "uuid",
  "code": "string",
  "language": "python"
}
```

The supported languages are `node`, `javascript`, `python`, `cpp`, `java`, and `c`. The route maps `javascript` to `node`.

The route performs these actions:

1. Load the question and its test cases
2. Verify that the question allows the language
3. Resolve the Judge0 language ID
4. Send the code to Judge0 for each test case
5. Compare the output with the expected output
6. Stop at the first failed test case
7. Record a passed submission for the session user when all test cases pass

The test cases come from `practice_questions.testcases`. When that array is empty, the route uses the legacy `practice_testcases` table.

Each Judge0 submission has a timeout of 20 seconds. The route uses the wait mode of Judge0.

The result statuses are:

- `Accepted` — the output matches and the status code is 3
- `Wrong Answer` — the output does not match
- `Compilation Error` — the status code is 6
- `Time Limit Exceeded` — the status code is 5
- `Runtime Error` — the status code is 11 or 12

Success response (200):

```json
{
  "passed": false,
  "results": [
    {
      "index": 0,
      "status": "Wrong Answer",
      "actual": "string",
      "stderr": "string",
      "time": "0.1",
      "memory": 1024,
      "passed": false,
      "expected": "string",
      "input": "string"
    }
  ]
}
```

Errors: `400`, `404`, `500`, `502`.

The route returns `400` when the language is not supported or not allowed for the question. It returns `404` when the question does not exist. It returns `500` when the question has no test cases. It returns `502` when the code execution service fails.

## Profile routes

### GET /api/profile/progress

This route returns the practice progress of the user.

Success response (200):

```json
{
  "solvedProblems": 12,
  "totalProblems": 80,
  "streakDays": 4
}
```

The route counts the distinct solved questions from `practice_submissions`. It counts the streak in UTC days that end today.

When the `practice_submissions` table does not exist, the route returns zero progress.

Errors: `401`, `500`.

### POST /api/profile/progress/reset

This route deletes all practice submissions of the user.

Success response (200):

```json
{
  "ok": true,
  "message": "Progress reset"
}
```

Errors: `401`, `500`.

## Telemetry route

### GET /api/telemetry/summary

This route returns the visitor and player summary.

The route creates the `cr_vid` cookie when the visitor has no cookie. The cookie lives for one year. The route counts a visitor as active for 5 minutes after their last request.

The route counts the active players from the `users` table. A player is active when their wins are greater than 0. It counts the matches created since midnight in the server time zone.

Success response (200):

```json
{
  "activePlayers": 42,
  "currentVisits": 7,
  "matchesToday": 5,
  "serverTime": "timestamp"
}
```

The route returns zero values when Supabase is not available.

Errors: none.
