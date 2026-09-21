# ADR-005: PostgreSQL with Drizzle ORM, PGlite for tests and development

## Status

Accepted (2026-09-18). Implemented in Phase 6 (`feat/backend-database`).

## Context

The API stores quiz sessions graded by the server, and later users, refresh
tokens, progress and leaderboard records. The data is relational (users →
sessions → answers), needs transactions and unique constraints for idempotent
writes, and leaderboards need ordered queries with deterministic tie-breaks.

Constraints:

- **No Docker** on the development machine (approved in Phase 0), so tests
  cannot rely on a database container.
- API tests must run the **real SQL** — the migrations, constraints and
  `ON CONFLICT` behaviour — not a mock of the repository.
- The schema and queries should be typed end to end in TypeScript, with SQL
  that remains readable in review.

Versions checked on 2026-09-18: `drizzle-orm` 0.45.2 and `drizzle-kit` 0.31.10
(1.0 is still in beta), `pg` 8.23, `@electric-sql/pglite` 0.5.8.

## Decision

- **PostgreSQL** is the database.
- **Drizzle ORM** defines the schema in TypeScript (`apps/api/src/db/schema.ts`)
  and builds typed queries. **drizzle-kit** generates plain SQL migrations into
  `apps/api/drizzle/`, which are committed and reviewed like code.
- Two drivers behind one `Database` type (`apps/api/src/db/database.ts`):
  - `pg` connection pool for a PostgreSQL server (`DATABASE_URL`);
  - **PGlite** — PostgreSQL compiled to WebAssembly, in-process — for tests
    (in memory, a fresh database per test file) and for development when no
    `DATABASE_URL` is set (on disk, `.data/pglite`).
- Production refuses to start without `DATABASE_URL`: PGlite serves one
  connection at a time and is not a production database.
- The API applies pending migrations at start-up. That is safe for the single
  instance planned now; with several instances, migrations become a separate
  deployment step (Phase 12).

## Alternatives

| Alternative                                    | Pros                                                                                                                                                   | Cons                                                                                                                 |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| **Drizzle** ✅                                 | Schema and queries in TypeScript, SQL-shaped API, generated SQL migrations to review, first-class PGlite driver, no code generation step at build time | 1.0 not released yet; fewer high-level conveniences than Prisma                                                      |
| **Prisma** 7                                   | Mature, excellent tooling and docs                                                                                                                     | Separate schema language and generated client; query engine and migrations less transparent; PGlite support indirect |
| **Kysely**                                     | Excellent type-safe query builder                                                                                                                      | No schema or migration generation of its own; more hand-written code                                                 |
| **Plain `pg` + SQL**                           | No abstraction at all                                                                                                                                  | Types, mapping and migrations all by hand                                                                            |
| **Testcontainers / Docker Postgres** for tests | Exactly the production server                                                                                                                          | Requires Docker, which is ruled out for now                                                                          |
| **SQLite** for tests                           | Fast, embedded                                                                                                                                         | A different SQL dialect: tests would not prove the PostgreSQL behaviour                                              |

## Consequences

**Positive**

- API tests exercise the same migrations, constraints and conflict handling
  as production, with no database server and no Docker, locally and in CI.
- `npm run start:api` works on a fresh checkout without installing anything.
- The TypeScript schema is the single source for types and migrations.

**Negative**

- PGlite and a PostgreSQL server can differ in details (extensions,
  concurrency, connection handling). Concurrency in particular is not
  exercised by PGlite, which runs one query at a time. CI therefore runs on
  PGlite, and the same suite runs against a PostgreSQL server with
  `TEST_DATABASE_URL` (verified on PostgreSQL 17.11 on 2026-09-21: all API
  tests, including two identical requests racing each other).
- Drizzle 0.x may change APIs before 1.0.
- `drizzle-kit` pulls an old `esbuild` through `@esbuild-kit/*`
  (`npm audit`: moderate, development only, affects esbuild's dev server,
  which drizzle-kit does not run).

## Rationale

Drizzle keeps the database visible — TypeScript that reads like SQL, and SQL
migrations in the repository — while PGlite makes the real PostgreSQL
behaviour testable on a machine without Docker. Both matter more for a
learning project than Prisma's higher-level conveniences.
