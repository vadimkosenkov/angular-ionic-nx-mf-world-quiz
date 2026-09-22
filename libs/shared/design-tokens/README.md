# shared-design-tokens

The values of every `--wq-*` design token (colours for the light and dark
themes, radii, shadows, spacing, type sizes), as two Sass mixins:

```scss
@use '…/shared/design-tokens/src/tokens';

:root {
  @include tokens.light-theme;
}
@media (prefers-color-scheme: dark) {
  :root {
    @include tokens.dark-theme;
  }
}
```

Plain CSS custom properties, no Angular or Ionic, so both the app
(`libs/client/ui`, dark theme through Ionic's `ion-palette-dark` class) and the
SSR site (`apps/site`, dark theme from `prefers-color-scheme`) use the same
values. Rules and contrast checks: docs/architecture/design-system.md.
