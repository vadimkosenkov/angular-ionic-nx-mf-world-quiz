# Frontend (shell)

> Status: **implemented** (Phase 3): Ionic shell, navigation, Home,
> Leaderboard, Achievements, Settings. Quiz screens arrive with the
> Capitals/Flags microfrontends (Phase 4–5); sign-in in Phase 7.

## Stack

- **Angular 22:** standalone components, **zoneless** change detection,
  OnPush by default, signals, `input()`, `@if`/`@for`/`@let`.
- **Ionic 9** in iOS mode (`provideIonicAngular({ mode: 'ios' })`),
  standalone imports from `@ionic/angular`.
- **Transloco** for runtime English/Russian ([i18n.md](i18n.md)).
- **Capacitor Preferences** for settings storage (works on the web through `localStorage`).

## Structure

```
apps/shell/src/app/
  app.config.ts        providers: Ionic, router, i18n, settings, icons
  app.routes.ts        tabs + lazy pages
  app.ts               <ion-app><ion-router-outlet/></ion-app>
  tabs/                ion-tabs with a translucent tab bar
  home/                greeting, overall progress, categories, practice, achievement preview
  leaderboard/         view and board selectors, rules, "not available yet" state
  achievements/        summary, legend, all 14 achievements
  settings/            theme, language, about
  core/
    progress.store.ts  learning progress as signals (in memory until Phase 8)
    tokens.ts          COUNTRY_DATASET, CLOCK
    greeting.ts        time-of-day greeting rule
  icons.ts             explicit ionicons registration
  app-info.ts          version shown in Settings
apps/shell/src/testing/ shared test providers and jsdom setup (not in the app build)
```

Libraries used by the shell:

| Library                          | Role                                                                           |
| -------------------------------- | ------------------------------------------------------------------------------ |
| `client-ui`                      | Tokens, themes, glass, `wq-progress-bar`, `wq-progress-card`, `wq-empty-state` |
| `client-i18n`                    | Transloco setup, bundled translations, `wqPlural`, locale detection            |
| `client-settings`                | `SettingsStore`, storage port, system colour-scheme signal, document sync      |
| `quiz-domain` / `quiz-countries` | Progress, achievements and all counts come from the domain and the dataset     |

## Routing

| URL                                                   | Page                        | Loading                |
| ----------------------------------------------------- | --------------------------- | ---------------------- |
| `/`                                                   | redirect to `/home`         | —                      |
| `/home`, `/leaderboard`, `/achievements`, `/settings` | tab pages inside `TabsPage` | lazy (`loadComponent`) |
| anything else                                         | redirect to `/home`         | —                      |

Tab URLs are deep-linkable (tested in Cypress). Quiz routes will be mounted
from the federated remotes under `/quiz/...` in Phase 4.

## Start-up sequence

1. `provideAppSettings()` registers an **app initializer**:
   - load settings from storage;
   - load the translation file for the stored (or device) language;
   - start `DocumentSettingsSync`.
2. Only then does Angular render, so there is no flash of the wrong theme or of untranslated keys.
3. `DocumentSettingsSync` keeps `<html class="ion-palette-dark">`,
   `color-scheme`, `<html lang>` and the active Transloco language in sync with
   the store for the rest of the session.

## Data shown on screens

Everything is derived; nothing is copied from the Figma mock-ups:

- **Country and region counts** (195, 6) come from the dataset.
- **Overall progress** is Capitals + Flags mastered, out of 2 × 195.
- **Achievements** (14) come from `evaluateAchievements`, with per-scope totals from the dataset.
- **Practice Mistakes** comes from `practiceCandidates`.
- **Leaderboard** shows the four real boards and rules, and an honest
  "not available yet" state until sign-in and the API exist.

`ProgressStore` holds progress in memory. A fresh start therefore shows zero
progress; persistence and sync arrive in Phase 8. The quiz phases call
`ProgressStore.record(events)` after each session.

## Bundle size

Production build (Phase 3):

|                                              | Raw        | Transferred (est.) |
| -------------------------------------------- | ---------- | ------------------ |
| Initial total                                | ≈ 712 kB   | ≈ 171 kB           |
| Largest initial chunk (Angular + Ionic core) | ≈ 579 kB   | ≈ 130 kB           |
| Each tab page                                | 3–10 kB    | 1–3 kB             |
| Each translation file                        | 2.5–3.5 kB | ≈ 1 kB             |

The Angular CLI template budget (500 kB warning) is below the Angular + Ionic
baseline, so the initial budget is **800 kB warning / 1 MB error**. On iOS
the files load from the device, not the network. Pages and translations are
lazy.

## Testing

- Component tests render pages with the real providers
  (`provideShellTesting()`), using in-memory storage, a fixed clock and a chosen language.
- `src/testing/test-setup.ts` adds the two browser APIs jsdom lacks and Ionic
  uses (`matchMedia`, `Element.scrollTo`).
- Ionic events (`ionChange`) are dispatched as DOM events in tests, which is
  exactly how Angular's Ionic bindings receive them.
- Cypress covers navigation, deep links, system/explicit theme, language
  switching and persistence across reloads, and bundled flag assets.
