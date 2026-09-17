# Design system

> Status: **implemented** (Phase 3). Code: [`libs/client/ui`](../../libs/client/ui).

## Direction

The app should feel like a polished, Apple-like learning tool: an indigo/blue
brand with a subtle lavender accent, cool neutral surfaces, generous spacing,
rounded cards, subtle depth and restrained colour. The Figma prototype defines
the hierarchy and layout. Its saturated purple, emoji illustrations and demo
numbers are **not** copied.

## Tokens

All colours, radii, shadows, spacing and motion values are CSS custom
properties in [`_tokens.scss`](../../libs/client/ui/src/styles/_tokens.scss).
Components use semantic names only (`--wq-color-surface`, never `#ffffff`), so
the palette can change in one place.

| Group              | Tokens                                                                                                                                                         |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Brand              | `primary`, `primary-bright`, `primary-strong`, `on-primary`, `primary-container`, `on-primary-container`, `accent`, `lavender`                                 |
| Surfaces           | `background`, `surface`, `surface-secondary`, `glass-surface`, `glass-border`, `glass-highlight`, `tab-bar-glass`, `border`, `overlay`                         |
| Segmented controls | `segment-background`, `segment-indicator`, `segment-checked`                                                                                                   |
| Text               | `text-primary`, `text-secondary`                                                                                                                               |
| Feedback           | `success`, `error`, `warning` and their `-container` variants                                                                                                  |
| Other              | `aurora-1..3` (background), `radius-*`, `shadow-card/raised/floating`, `space-*`, `duration-*`, `easing-standard`, `touch-target` (44 px), `tab-bar-clearance` |

### Light and dark

The dark theme is a separate palette, not an inversion:

- surfaces are deep navy (`#0b0e1f`, `#151a33`), not grey;
- the primary colour becomes lighter (`#8b9aff`) and takes dark text on filled controls;
- shadows are stronger and glass is tinted navy.

The theme is switched by the class `ion-palette-dark` on `<html>`, which is
also what Ionic's `palettes/dark.class.css` expects. `DocumentSettingsSync`
(libs/client/settings) toggles it and sets `color-scheme`.

### Contrast

Checked with the WCAG 2.2 formula; normal-size text needs ≥ 4.5:1.

| Pair                                                    | Light           | Dark            |
| ------------------------------------------------------- | --------------- | --------------- |
| text-primary on background                              | 15.6            | 16.9            |
| text-secondary on background                            | 6.1             | 8.8             |
| text-secondary on surface-secondary                     | 5.7             | 7.1             |
| primary-strong (links) on surface                       | 6.1             | —               |
| primary (links) on surface                              | —               | 6.7             |
| on-primary on primary (filled controls)                 | 4.9             | 7.4             |
| on-primary-container on primary-container               | 7.2             | 9.8             |
| success / error / warning on their containers (light)   | 4.8 / 4.8 / 5.1 | —               |
| success / error / warning on surface (dark)             | —               | 8.9 / 6.8 / 9.4 |
| segment label, selected (on its indicator)              | 7.2             | 9.2             |
| segment label, not selected (on the segment background) | 6.6             | 7.8             |

`primary-bright` (`#4f6bff`, the brand colour from the brief) only reaches
4.3:1 with white text, so it is used for gradients and decoration, and
`primary` (`#4660f5`) is used for filled controls.

## Ionic theming

[`_ionic.scss`](../../libs/client/ui/src/styles/_ionic.scss) maps the tokens
to Ionic variables (`--ion-color-primary`, `--ion-background-color`,
`--ion-item-background`, tab bar and toolbar colours, segments).

- Ionic sets some variables per mode, so they are overridden with
  `:root.ios` / `:root.ion-palette-dark.ios` specificity (see the Ionic 9 dark mode docs).
- The app forces **iOS mode on every platform** (`provideIonicAngular({ mode: 'ios' })`).
  The product is an iPhone app first, and one visual language keeps web,
  simulator and screenshots identical.

## Liquid Glass

Glass is **progressive enhancement** and used **selectively**:

| Surface                                                                                    | Why glass                                              |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------ |
| Tab bar (`ion-tab-bar.wq-floating-tab-bar`)                                                | A floating capsule; page content scrolls underneath it |
| Main header after scrolling (`ion-header translucent`)                                     | Same                                                   |
| The one hero summary per screen (`wq-progress-card variant="glass"`, achievements summary) | Focal point                                            |
| Theme selector                                                                             | A floating control                                     |

Lists, category cards and achievement cards stay solid; the featured category
card is an **accent** surface (a brand gradient), not glass.

How it degrades (`_glass.scss`):

1. **Baseline:** an opaque surface with a border, readable everywhere.
2. **Enhancement:** translucent background, `backdrop-filter: blur(24px) saturate(180%)`,
   an inner highlight and a soft shadow. Applied only when
   `@supports (backdrop-filter …)` is true **and** the user has not requested
   `prefers-reduced-transparency: reduce`.
3. With reduced transparency, the tab bar and the translucent toolbars also switch to opaque surfaces.

### Floating tab bar

The tab bar is the most visible glass surface and follows the iOS 26
"floating" style:

- **Position:** absolutely positioned inside `ion-tabs`, 12 px from the sides
  and above the safe area, so the content really passes underneath it. Tab
  pages reserve `--wq-tab-bar-clearance` (92 px + safe area) at the bottom.
- **Glass:** a capsule with a lighter top gradient, 45 % (light) / 55 % (dark)
  tint, `blur(10px) saturate(200%)`, an inner top highlight and a floating shadow.
  The bar is 60 px high in total (`--wq-tab-bar-height`), with a 4 px inner
  padding. Ionic forces `content-box` sizing inside its shadow DOM, so the
  content height is calculated as 60 − 2 × 4 − 2 (borders).
- **Tab buttons:** 50 px high, with 6 px vertical and 8 px horizontal padding.
  Labels therefore keep at least ~7 px from the edges of the selected pill,
  including the longest labels ("Achievements", "Достижения"). This was
  checked at 375 px and 320 px widths in both languages; nothing is truncated. The light blur keeps the
  content underneath recognizable, which reads more like glass than frosting.
- **Selected tab:** a translucent primary pill behind the icon and label, in
  addition to the filled icon and the colour change.
- **Fallback:** without `backdrop-filter`, or with reduced transparency, an
  opaque surface with a border and the same shadow.

Ionic's own `translucent` tab bar is not used: Ionic lays the bar out below
the content, so there would be nothing to see through it.

An "aurora" background (three soft radial gradients, `ion-content.wq-aurora`)
gives the glass something to refract. No functionality depends on the effect.

Browser notes: WebKit (iOS Safari/WKWebView) supports `-webkit-backdrop-filter`;
Chromium and Firefox support `backdrop-filter`. `prefers-reduced-transparency`
is supported in Chromium and WebKit; where it is not, the enhancement stays on.

## Components

| Component          | Purpose                                                                             | Accessibility                                                                                                                |
| ------------------ | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `wq-progress-bar`  | Thin gradient bar, `primary` or `success` tone                                      | `role="progressbar"` with `aria-valuemin/max/now`, a label and a translated `aria-valuetext` ("3 of 44"); values are clamped |
| `wq-progress-card` | Heading, big `value / max`, bar, caption row; `solid` or `glass`                    | The visual number is `aria-hidden`; the bar carries the accessible value                                                     |
| `wq-empty-state`   | Icon, heading, message, projected actions for empty, unavailable and offline states | `role="status"`; decorative icon hidden                                                                                      |

UI components are **i18n-free**: they receive already translated strings.
Ionic components (tabs, segments, lists, radios, badges) are used directly
where they already fit; nothing is rebuilt from scratch.

### Segmented controls

`ion-segment` is styled globally so that every segment looks the same
(Appearance, leaderboard views and boards):

- **Container:** `segment-background` (white in light, navy surface in dark),
  a border and the card shadow, so it stays distinct from the aurora
  background: white on the page background alone would be only 1.09:1.
- **Selected pill:** `segment-indicator` (indigo container), a soft shadow,
  the `segment-checked` label colour and a bolder weight. The state is not
  shown by background colour alone.
- **Concentric radius:** the indicator radius is the container radius minus
  the container padding (`--wq-segment-radius − --wq-segment-padding`,
  e.g. 24 − 4 = 20 px). Both curves then run parallel, with an even 4 px gap
  on every side. Ionic's default 7 px radius and inner offsets are removed.
- **`wq-segment-pill`:** a variant with fully rounded ends, for compact filters.
- Scrollable segments hide the scrollbar.

Global helpers in `_base.scss`: `.wq-page` (max width 720 px for tablet and
web), `.wq-section`, `.wq-section-title`, `.wq-card`, `.wq-text-secondary`,
`.wq-visually-hidden`.

## Accessibility rules applied

- Status is never shown by colour alone: achievement states have an icon and a text label.
- Touch targets are at least 44 px (`--wq-touch-target`, Ionic list items 56 px).
- `:focus-visible` shows a 3 px outline for keyboard users on the web.
- `prefers-reduced-motion` reduces animations and transitions to near zero.
- Decorative images (language flags) have `alt=""`; the language name is text.
- `<html lang>` follows the UI language, and each language name is marked with its own `lang`.
- The tab bar is a `tablist` with `tab` items and `aria-selected` (rendered by Ionic).

## Assets and licenses

- Flags: `flag-icons` SVGs are copied into the build (`flags/*.svg`), and the
  MIT license into `licenses/flag-icons/LICENSE`.
- Icons: `ionicons` SVGs, registered explicitly in `apps/shell/src/app/icons.ts`,
  so only the icons used are bundled. No icon CDN is used.
- Fonts: the system font stack (SF Pro on Apple devices); no web fonts to download.
