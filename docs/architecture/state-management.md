# State management

> Decision: [ADR-004](../decisions/ADR-004-state-management.md).

## Principles

1. **Pure domain state, framework-free.** Quiz sessions, mastery and progress
   are immutable values transformed by pure functions in `quiz-domain`.
2. **Signal stores at the application edge.** An injectable store owns one
   private `signal()`, exposes read-only `computed()` values and changes state
   only through methods.
3. **Effects only for synchronization with the outside world** (DOM classes,
   `<html lang>`, the Transloco language), never for deriving state.
4. **RxJS where streams are the natural model:** HTTP composition, retries and
   `firstValueFrom` around `HttpClient` in the sync, and Transloco's loader
   API. The sync itself is a plain async loop with explicit retry scheduling,
   which reads (and tests) more simply than an operator chain here.
   RxJS is not used for simple synchronous state.
5. **No global mutable object shared by every app.** Microfrontends talk to the
   shell through routes and injected ports (Phase 4).

## Current stores

| Store           | Library           | State                                              | Derived signals                                                                                                                                              | Persistence                                                                                  |
| --------------- | ----------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| `SettingsStore` | `client-settings` | `{ theme, locale }`                                | `theme`, `locale`, `colorScheme` (resolves `system` with the live OS preference)                                                                             | `KeyValueStorage` port → Capacitor Preferences                                               |
| `ProgressStore` | `client-progress` | finished sessions (`LocalSession` by id), owner    | progress rebuilt from their events; `achievements`, `worldProgress`, `combinedProgress`, `mistakeCount`, `pending` (outbox), `pendingCount`, `rejectedCount` | `LocalStore` port → IndexedDB (Dexie) ([ADR-006](../decisions/ADR-006-local-persistence.md)) |
| `AuthStore`     | `client-auth`     | status, user, busy, error                          | `signedIn`                                                                                                                                                   | none: access token in memory, refresh token in an httpOnly cookie                            |
| `SyncService`   | `client-progress` | status (`idle` / `syncing` / `offline`), last sync | —                                                                                                                                                            | none (drives `ProgressStore`)                                                                |

### Anatomy of a store

```ts
@Injectable({ providedIn: 'root' })
export class SettingsStore {
  private readonly state = signal<AppSettings>(initial); // single source of truth

  readonly theme = computed(() => this.state().theme); // read-only views
  readonly colorScheme = computed(() => resolveColorScheme(this.theme(), this.systemPrefersDark()));

  setTheme(theme: ThemePreference): void {
    // intent methods
    this.update({ theme });
  }
}
```

- **Persistence is fire-and-forget but ordered:** writes are chained on one
  promise, so the last change wins. A failed write is reported through
  `ErrorHandler`, and the new value still applies for the session.
- **Reading persisted data is defensive:** malformed JSON or unknown values
  fall back field by field.
- **Environment inputs are injection tokens** (`DEVICE_LANGUAGES`,
  `SYSTEM_PREFERS_DARK`, `CLOCK`, `COUNTRY_DATASET`), so tests replace them
  without touching globals.

## Why this works with zoneless Angular

Templates read signals, so Angular knows exactly which views to refresh when a
store changes. There is no Zone.js to patch async APIs, and none is needed:
every async result (storage, translation loading) ends in a signal write.
Transloco's pipe marks views for check itself when the language changes.

## When to reconsider

NgRx (Store or SignalStore) becomes worth its weight if several features need
shared, cross-cutting state with complex update flows: for example, if the
sync engine needs undo/replay tooling or devtools time travel. That
would be recorded in a new ADR.
