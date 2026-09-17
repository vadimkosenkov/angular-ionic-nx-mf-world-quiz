# client-ui

`@world-quiz/client/ui` · tags: `scope:client`, `type:ui`

The World Quiz design system: semantic design tokens (light and dark), Ionic
theme mapping, Liquid Glass surfaces with fallbacks, global layout helpers,
and small presentational components. Components are i18n-free: they receive
translated text as inputs.

- Styles: `src/styles/index.scss` (add to an app's `styles` after Ionic's CSS)
- Components: `wq-progress-bar`, `wq-progress-card`, `wq-empty-state`

Documentation: [docs/architecture/design-system.md](../../../docs/architecture/design-system.md)

## Commands

```bash
npx nx test client-ui
npx nx typecheck client-ui
npx nx lint client-ui
```
