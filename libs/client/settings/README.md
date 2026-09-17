# client-settings

`@world-quiz/client/settings` · tags: `scope:client`, `type:data-access`

User preferences (theme: light/dark/system, language) as a signal store,
persisted through a `KeyValueStorage` port (Capacitor Preferences by default),
plus `DocumentSettingsSync`, which applies the Ionic dark palette class,
`color-scheme` and `<html lang>`, and sets the Transloco language.

```ts
providers: [provideAppI18n(), provideAppSettings()];
```

Documentation: [docs/architecture/state-management.md](../../../docs/architecture/state-management.md),
[docs/architecture/design-system.md](../../../docs/architecture/design-system.md)

## Commands

```bash
npx nx test client-settings
npx nx typecheck client-settings
npx nx lint client-settings
```
