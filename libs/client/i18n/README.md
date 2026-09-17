# client-i18n

`@world-quiz/client/i18n` · tags: `scope:client`, `type:data-access`

Transloco configuration for English and Russian with translations bundled as
typed TypeScript modules (no HTTP), device language detection, and the
`wqPlural` pipe based on `Intl.PluralRules`.

```ts
providers: [provideAppI18n()];
```

Documentation: [docs/architecture/i18n.md](../../../docs/architecture/i18n.md)

## Commands

```bash
npx nx test client-i18n
npx nx typecheck client-i18n
npx nx lint client-i18n
```
