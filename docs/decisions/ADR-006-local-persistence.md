# ADR-006: Progress on the device in IndexedDB (Dexie), an outbox, and sync by exchanging sessions

## Status

Accepted (2026-09-22). Implemented in Phase 8a (`feat/sync-server`, the API's
history) and Phase 8b (`feat/sync-client`, `libs/client/progress`).

## Context

- Playing, progress, mistakes and achievements must work **offline** and
  survive restarts, in a browser and in the iOS app (a WebView).
- Results must reach the player's account **exactly once**, even when a
  request times out after the server stored it, and must follow the player to
  every device.
- The server grades every session itself (ADR-010, backend.md); the client
  never sends scores or mastery.
- Progress is a deterministic fold over answers with a canonical order
  (`rebuildProgress`, docs/domain/mastery.md): the same answers give the
  same mastery in any arrival order.
- A device may be shared, and playing needs an account (ADR-011).

## Decision

1. **The state kept on the device is the set of finished sessions**, not a
   progress snapshot. Each `LocalSession` has its id, a sync state
   (`pending` / `synced` / `rejected`), its answers as progress events, and —
   when played on this device — the request that records it. Progress is
   rebuilt from the events of all sessions that are not `rejected`.
2. **IndexedDB through Dexie, behind a `LocalStore` port.** Tables:
   `sessions` (key `id`, index `sync`) and `meta` (`owner`, history
   `cursor`). Schema versions are append-only `version(n)` blocks. Tests use
   an in-memory `LocalStore`, and `fake-indexeddb` for the Dexie
   implementation itself.
3. **Outbox.** A finished session is written with `sync: 'pending'` and
   progress updates at once. `SyncService` sends pending sessions oldest
   first with `POST /v1/sessions`; the client-generated id makes a resend
   idempotent (200 with the stored result).
4. **Refusals are final, silence is not.** 422, 409 or 400 mark a session
   `rejected`: it stops counting (the account and other devices never had
   it), is reported to `ErrorHandler`, and Settings says so. No answer, 5xx
   or 429 end the run and schedule another after 5 s, 30 s, 2 min, then
   every 10 min. A 401 after which the player is signed out stops syncing.
5. **Pull by history.** After sending, `GET /v1/sessions?after=<cursor>`
   pages through the account's sessions (graded by the server); new ones are
   added, the device's own come back as `synced`, and the cursor is stored in
   the same transaction as the page.
6. **When to sync:** after sign-in or a restored session, after every
   finished quiz, on the browser's `online` event, and when the app returns
   to the foreground. One run at a time; a request during a run queues one
   more.
7. **The data on a device belongs to one account (`owner`).** Signing in as
   another account deletes the previous account's data before anything is
   shown. **Signing out deletes the account's data** from the device; if
   results are still pending, the app tries to send them first and, if that
   fails, asks before losing them. Deleting the account deletes it too.

## Alternatives

| Alternative                                              | Why not                                                                                                                                          |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| **`localStorage` / Capacitor Preferences** for progress  | Synchronous, string-only, small quotas; no transactions for "page + cursor"; fine for settings, not for a growing history                        |
| **`idb`** (thin promise wrapper)                         | Smaller, but schema versions, bulk writes and transactions are hand-written; Dexie was planned in Phase 0 and keeps the store short              |
| **Store a progress snapshot** and sync mastery values    | Two devices would each hold a different "truth" to merge; sessions are facts, and the domain rebuilds the same mastery from them in any order    |
| **Server computes progress** and the client downloads it | Offline play would still need the local fold; history gives both devices the same inputs, and the server stays authoritative through its grading |
| **Keep the account's data after sign-out** (as a guest)  | A shared device would show one player's results to the next, and a second account would mix them                                                 |
| **Background Sync API / service worker**                 | Not available in iOS WebViews; triggers on `online` and foreground cover the same need in-app                                                    |

## Consequences

**Positive**

- Offline play is the normal path: every result is stored locally first and
  sent when possible; nothing is lost when a response is.
- Sync is "exchange facts, rebuild": no merge conflicts to resolve.
- Every device of a player shows the same mastery once synced.

**Negative**

- Progress is recomputed from all events on every change (tens of thousands
  at most for a heavy player — milliseconds); a cached snapshot is possible
  later if it is ever measured to matter.
- A result the server rejects disappears from progress on the device that
  played it. This should only happen with a bug or tampering; Settings says
  how many.
- Results played offline and never sent are lost if the player confirms
  signing out. The app asks first, with the number.
- IndexedDB can be cleared by the browser under storage pressure (Safari
  after 7 days without use on the web); synced results come back from the
  account, pending ones would be lost. Requesting persistent storage
  (`navigator.storage.persist()`, not done yet) and the iOS app reduce this.

## Rationale

Keeping sessions — the facts — on the device and exchanging them with an
idempotent outbox and a keyset history is the smallest design that works
offline, never double-counts, and gives every device the same result,
because the domain already guarantees an order-independent fold.
