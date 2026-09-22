# client-progress

The player's learning progress on the device, and its synchronisation with
the account ([ADR-006](../../../docs/decisions/ADR-006-local-persistence.md)).

- `ProgressStore` — finished sessions as signals; progress is rebuilt from
  their answers with the domain's canonical order, so sessions from several
  devices give the same mastery in any order.
- `LocalStore` — the persistence port: IndexedDB through Dexie in the app,
  in memory in tests. The data belongs to one account (`owner`).
- `SyncService` — sends the outbox (`POST /v1/sessions`, idempotent), then
  pulls the account's history (`GET /v1/sessions`, keyset cursor); retries
  with growing delays when offline.
- `provideProgress()` — wiring: load at start-up, sync on sign-in, on
  reconnect and when the app returns to the foreground.
