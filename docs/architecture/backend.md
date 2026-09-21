# Backend (API)

> Status: ✅ Phase 6 — Express 5 API, PostgreSQL schema with Drizzle,
> migrations, and recording of finished quiz sessions graded by the server.
> 📐 Sign-in (Phase 7), progress sync (Phase 8), leaderboards (Phase 9).
> The client does not call the API yet; it starts sending sessions with the
> offline-sync phase.

Why PostgreSQL, Drizzle and PGlite: [ADR-005](../decisions/ADR-005-database.md).

## Structure

```
apps/api/
  drizzle.config.ts        drizzle-kit: schema → SQL migrations
  drizzle/                 generated SQL migrations (committed)
  src/
    main.ts                composition root: config → database → migrate → app → listen
    config.ts              environment, validated with Zod at start-up
    app.ts                 Express app factory (no listen), error handling
    http/problem.ts        RFC 9457 problem-details responses
    db/schema.ts           tables (Drizzle)
    db/database.ts         PostgreSQL (pg) or PGlite behind one Database type
    sessions/
      sessions.routes.ts   HTTP: parse, call the service, map outcomes to status codes
      session-service.ts   the rules: plausibility, replay, idempotency
      session-repository.ts  SQL only
      request-hash.ts      canonical JSON + SHA-256
    testing/               in-memory test database, a helper that plays real sessions
libs/shared/contracts/     Zod schemas of requests, responses and errors
```

Layers depend inward: routes → service → repository → database. The service
knows the quiz rules (through `quiz-domain`) but no SQL; the repository knows
SQL but no quiz rules. `createApp()` receives its dependencies, so tests use a
manual clock and an in-memory database.

## Recording a session: `POST /v1/sessions`

The client sends **what the player did** — configuration, seed, timestamps and
the answers given — and never a score, correctness or mastery. The request
schema is strict: unknown fields such as `score` are rejected, not ignored.

```mermaid
sequenceDiagram
  participant C as Client
  participant R as sessions.routes
  participant S as SessionService
  participant D as quiz-domain
  participant DB as PostgreSQL

  C->>R: POST /v1/sessions {id, config, seed, startedAt, finishedAt, endReason, submissions}
  R->>R: parse with the shared Zod contract (400 on mismatch)
  R->>S: submit(request)
  S->>DB: session with this id?
  alt same id, same request hash
    S-->>R: duplicate → 200 with the stored result
  else same id, different request
    S-->>R: conflict → 409
  end
  S->>S: plausibility: not in the future, not before start, ≤ 24 h
  S->>D: replay(request): regenerate questions from the seed, re-grade every answer
  D-->>S: graded session, or why it cannot be replayed (422)
  S->>DB: INSERT session + answers in one transaction (ON CONFLICT DO NOTHING)
  S-->>R: created → 201 + Location
```

- **The server grades.** `replay` rebuilds the exact questions from the seed and
  runs every answer through the same matching rules the client used. A choice
  that was not offered, a text answer in Easy mode, answers after the time ran
  out, or an ending that does not match the answers make the whole session
  **rejected** (422) — the server does not "fix" a session.
- **Idempotency.** `id` is a UUID the client generates once per session. The
  server stores a SHA-256 of the canonical request (keys sorted, so key order
  does not matter). A retry with the same body returns the stored result
  (200); a different body under the same id is a conflict (409). Two identical
  requests racing each other are resolved by the primary key and
  `ON CONFLICT DO NOTHING`: exactly one inserts.
- **Plausibility.** `finishedAt` may be at most 5 minutes ahead of the server
  clock and at most 24 hours after `startedAt`. These bounds stop obviously
  forged timestamps; precise timing for leaderboards is decided in Phase 9.

`GET /v1/sessions/:id` returns the stored result (404 when unknown, 400 when
the id is not a UUID).

### Honest limits of Phase 6

- **No authentication.** Sessions are anonymous (`user_id` is null) and can be
  read by anyone who knows their random id. The API is not deployed before
  sign-in exists (Phase 7).
- **No rate limiting** yet; added with authentication.
- The shell does not send sessions yet (Phase 8 adds the outbox and sync).

## Errors

Every error is an [RFC 9457](https://www.rfc-editor.org/rfc/rfc9457) problem
document (`application/problem+json`), described by `problemDetailsSchema` in
`shared/contracts`:

| Status | When                                                                                                                              |
| ------ | --------------------------------------------------------------------------------------------------------------------------------- |
| 400    | Body breaks the contract (with `errors: [{path, message}]`), malformed JSON, malformed id                                         |
| 404    | Unknown session or route                                                                                                          |
| 409    | Session id already used by a different session                                                                                    |
| 413    | Body larger than 256 kB                                                                                                           |
| 422    | Well-formed session the server cannot verify; `type` names the reason, e.g. `urn:world-quiz:session-rejected:inconsistent-ending` |
| 500    | Anything unexpected: logged on the server, generic message to the client                                                          |

## Database

```mermaid
erDiagram
  quiz_sessions ||--o{ quiz_answers : has
  quiz_sessions {
    uuid id PK "client-generated idempotency key"
    uuid user_id "null until Phase 7"
    jsonb config "exact replayed configuration"
    text seed
    timestamptz started_at
    timestamptz finished_at
    text end_reason
    int answered
    int correct
    int duration_ms
    bool completed
    bool perfect
    text request_hash
    timestamptz recorded_at
  }
  quiz_answers {
    uuid session_id PK, FK
    int sequence PK
    text country_code
    jsonb answer "what the player submitted"
    bool correct "server's judgement"
    text judgement "choice | exact | typo | incorrect"
    timestamptz answered_at
  }
```

- Category, difficulty, mode and scope are also stored as columns for queries
  (leaderboards, statistics); `config` keeps the exact replay input.
- The database enforces invariants too: `correct <= answered`,
  `duration_ms >= 0`, answers cascade-delete with their session.
- Enumerations are `text`, validated at the API boundary against the domain
  vocabulary. PostgreSQL enums would make adding a mode a migration.

### Migrations

```bash
npx nx run api:db-generate   # after changing src/db/schema.ts
```

drizzle-kit compares the schema with the last snapshot in `drizzle/meta` and
writes a new SQL file. Review it like code and commit it. The API applies
pending migrations when it starts; tests apply all of them to a fresh
in-memory database.

## Tests on PGlite and on PostgreSQL

API tests (`npx nx test api`) use an in-memory PGlite by default — the same
in CI. To run the same suite against a PostgreSQL server:

```bash
TEST_DATABASE_URL=postgres://localhost:5432/world_quiz npx nx test api
```

Each test file then creates its own temporary database on that server
(`world_quiz_test_<random>`), applies the migrations and drops it at the end,
so test files can run in parallel. The user needs the `CREATEDB` privilege
(Homebrew's default user has it). `TEST_DATABASE_URL` is part of the Nx cache
key, so a PostgreSQL run never reuses a PGlite result.

PostgreSQL is where concurrency is real: the test "records two identical
requests that race each other exactly once" exercises the primary key and
`ON CONFLICT DO NOTHING`; on PGlite the same test passes because queries run
one at a time.

## Running

```bash
npm run start:api   # http://localhost:3333 — PGlite in .data/pglite, no setup needed
DATABASE_URL=postgres://localhost:5432/world_quiz npm run start:api   # a PostgreSQL server
```

Variables: [environment.md](../development/environment.md).
