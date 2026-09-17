# Architecture Decision Records

An ADR captures one significant decision: the context, the options considered,
what was chosen, and the consequences. ADRs are never edited to change a
decision. A new ADR supersedes the old one.

| ADR                                  | Decision                                                        | Status                            |
| ------------------------------------ | --------------------------------------------------------------- | --------------------------------- |
| [ADR-001](ADR-001-nx.md)             | Nx integrated monorepo                                          | Accepted                          |
| [ADR-002](ADR-002-microfrontends.md) | Native Federation for Capitals/Flags microfrontends             | Accepted                          |
| ADR-003                              | SSR: separate `apps/site` + SSR-in-shell spike result           | Planned (written after the spike) |
| ADR-004                              | State management: signal stores, no NgRx                        | Planned (shell phase)             |
| ADR-005                              | Database access: PostgreSQL + Drizzle                           | Planned (backend phase)           |
| ADR-006                              | Local persistence: IndexedDB (Dexie) behind a `LocalStore` port | Planned (offline phase)           |
| [ADR-007](ADR-007-testing.md)        | Testing stack                                                   | Accepted                          |
| [ADR-008](ADR-008-country-data.md)   | Curated static country dataset and `flag-icons` flags           | Accepted                          |

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
