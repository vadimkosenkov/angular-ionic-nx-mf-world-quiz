# ADR-004: Signal-based stores, no NgRx

## Status

Accepted (2026-09-17)

## Context

The client needs state for user settings, learning progress, quiz sessions,
authentication and synchronization. Angular 22 is zoneless by default, with
stable signals, `computed`, `effect` and `resource`/`httpResource`. Most
business rules already live in the pure `quiz-domain` library as immutable
data and pure functions.

The project is a learning vehicle, but unnecessary global state machinery
should be avoided.

## Decision

- Use **injectable signal stores**: a private writable `signal`, public
  `computed` read models, and intent methods. Side effects that talk to the
  outside world (storage, DOM, Transloco) sit at the store boundary.
- Keep domain state transitions in `quiz-domain` (pure functions); stores wrap them.
- Use **RxJS** only where streams add value: HTTP composition, retry and
  backoff, cancellation, and library APIs that are Observable-based.
- Inject environment inputs (clock, device languages, colour-scheme query,
  storage, dataset) through **injection tokens**.
- **No NgRx** for now.

## Alternatives

| Alternative                                 | Why not (now)                                                                                                                    |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| **NgRx Store** (actions, reducers, effects) | Much ceremony for a handful of stores; the domain already provides pure reducers                                                 |
| **NgRx SignalStore**                        | Reasonable, but adds a library and its own concepts for what plain signals cover. It remains the first candidate if stores grow. |
| **RxJS `BehaviorSubject` services**         | Pre-signals pattern; needs manual subscription management and is less precise for zoneless change detection                      |
| **Component-local state only**              | Settings and progress are shared across tabs and (later) microfrontends                                                          |

## Consequences

**Positive**

- Minimal code, fine-grained rendering, a natural fit for zoneless Angular.
- Stores are easy to test: override tokens, call methods, read signals.
- Domain logic stays reusable on the server.

**Negative**

- No built-in devtools or time travel.
- Conventions (one private signal, intent methods) are enforced by review, not by a framework.
- Cross-store orchestration (e.g. sync) must be designed explicitly in Phase 8
  — done in [ADR-006](ADR-006-local-persistence.md): `SyncService` coordinates
  `AuthStore` and `ProgressStore`, which do not know about each other.

## Rationale

Signals are Angular's primary reactivity model, and the domain already holds
the complex rules. A thin, explicit store layer demonstrates modern Angular
without adding a framework on top of it.
