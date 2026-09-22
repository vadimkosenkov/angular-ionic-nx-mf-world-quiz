# Architecture Decision Records

An ADR captures one significant decision: the context, the options considered,
what was chosen, and the consequences. ADRs are never edited to change a
decision. A new ADR supersedes the old one.

| ADR                                     | Decision                                                           | Status                            |
| --------------------------------------- | ------------------------------------------------------------------ | --------------------------------- |
| [ADR-001](ADR-001-nx.md)                | Nx integrated monorepo                                             | Accepted                          |
| [ADR-002](ADR-002-microfrontends.md)    | Native Federation for Capitals/Flags microfrontends                | Accepted                          |
| ADR-003                                 | SSR: separate `apps/site` + SSR-in-shell spike result              | Planned (written after the spike) |
| [ADR-004](ADR-004-state-management.md)  | State management: signal stores, no NgRx                           | Accepted                          |
| [ADR-005](ADR-005-database.md)          | Database access: PostgreSQL + Drizzle, PGlite for tests/dev        | Accepted                          |
| [ADR-006](ADR-006-local-persistence.md) | Progress on the device (IndexedDB/Dexie), outbox, sync by sessions | Accepted                          |
| [ADR-007](ADR-007-testing.md)           | Testing stack                                                      | Accepted                          |
| [ADR-008](ADR-008-country-data.md)      | Curated static country dataset and `flag-icons` flags              | Accepted                          |
| [ADR-009](ADR-009-i18n.md)              | Runtime i18n with Transloco and bundled translation modules        | Accepted                          |
| [ADR-010](ADR-010-authentication.md)    | Sign-in: provider ID tokens, JWT access, rotating refresh tokens   | Accepted                          |
| [ADR-011](ADR-011-sign-in-required.md)  | Sign-in is required before playing                                 | Accepted                          |

Template:

```markdown
# ADR-XXX: Title

## Status

Proposed / Accepted / Rejected / Superseded by ADR-YYY

## Context

## Decision

## Alternatives

## Consequences

## Rationale
```
