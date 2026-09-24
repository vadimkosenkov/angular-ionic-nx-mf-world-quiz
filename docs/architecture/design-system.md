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
properties. Their values live in
[`libs/shared/design-tokens`](../../libs/shared/design-tokens/src/_tokens.scss)
as two Sass mixins (`light-theme`, `dark-theme`), so the app and the SSR site
([site.md](site.md)) share them;
[`client/ui`'s `_tokens.scss`](../../libs/client/ui/src/styles/_tokens.scss)
applies them to `:root` and Ionic's `:root.ion-palette-dark`, the site to
`:root` and `prefers-color-scheme: dark`.
Components use semantic names only (`--wq-color-surface`, never `#ffffff`), so
the palette can change in one place.

| Group              | Tokens                                                                                                                                                                                                                                               |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Brand              | `primary`, `primary-bright`, `primary-strong`, `on-primary`, `primary-container`, `on-primary-container`, `accent`, `lavender`                                                                                                                       |
| Surfaces           | `background`, `surface`, `surface-secondary`, `glass-surface`, `glass-border`, `glass-highlight`, `tab-bar-glass`, `border`, `overlay`                                                                                                               |
| Segmented controls | `segment-background`, `segment-indicator`, `segment-checked`                                                                                                                                                                                         |
| Text               | `text-primary`, `text-secondary`                                                                                                                                                                                                                     |
| Feedback           | `success`, `error`, `warning` and their `-container` variants                                                                                                                                                                                        |
| Other              | `aurora-1..3` (background), `radius-*`, `shadow-card/raised/floating`, `drop-shadow-control` (a `filter` for shapes that are not their box, e.g. an iframe), `space-*`, `duration-*`, `easing-standard`, `touch-target` (44 px), `tab-bar-clearance` |

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

| Component          | Purpose                                                                                          | Accessibility                                                                                                                |
| ------------------ | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| `wq-progress-bar`  | Thin gradient bar; `primary`, `success` or `warning` tone (the last for a countdown running out) | `role="progressbar"` with `aria-valuemin/max/now`, a label and a translated `aria-valuetext` ("3 of 44"); values are clamped |
| `wq-progress-card` | Heading, big `value / max`, bar, caption row; `solid` or `glass`                                 | The visual number is `aria-hidden`; the bar carries the accessible value                                                     |
| `wq-empty-state`   | Icon, heading, message, projected actions for empty, unavailable and offline states              | `role="status"`; decorative icon hidden                                                                                      |

UI components are **i18n-free**: they receive already translated strings.
Ionic components (tabs, segments, lists, radios, badges) are used directly
where they already fit; nothing is rebuilt from scratch.

### Type scale for controls

Every choice control uses one size, `--wq-font-size-control` (15 px, iOS
"subheadline"): segments across the app and the option lists on the quiz
setup page. Secondary lines under or inside a control use
`--wq-font-size-caption` (13 px, iOS "footnote"). Ionic's iOS segments default
to 13 px, which made them look smaller than neighbouring option buttons.

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

### One glass material for all chrome

The floating tab bar and translucent page headers share the `glass-chrome`
mixin (`_glass.scss`): the tab bar's tint, a top
highlight, an inner light edge and `blur(10px) saturate(200%)`. Headers apply
it to Ionic's `.header-background` layer and keep the toolbar transparent, so
content scrolling underneath is visibly blurred. Every page shows this bar
with its title at all times; iOS large titles that only turn into a bar on
scroll were dropped in favour of one consistent header. Without
`backdrop-filter`,
or with reduced transparency requested, all of them fall back to an opaque
surface.

### Actions live at the bottom

A screen's next step is always in the same place: `.wq-action-bar`, fixed to
the bottom above the content (which keeps `--wq-action-bar-clearance` free).
Its buttons are `ion-button.wq-glass-button`: pill-shaped with a **solid**
fill — primary, or `secondary` (surface, primary label, border). A
translucent tinted fill was tried and dropped: over busy content the label
lost contrast and the button looked washed out. Used for Start quiz, Check,
Continue, Finish, Play again and Back to home.

The verdict of an answer is shown under the flag, never next to the button.
After a wrong answer the correct answer gets its own white block with the
largest text on the screen, because it is what the player should remember.

Feedback blocks are tinted with `--wq-color-success-vivid` /
`--wq-color-error-vivid` (the iOS system green and red) and glow softly in the
same hue. The darker `success` / `error` tokens are for text only: mixed into a
fill they turned greyish and did not read as "correct" on the lavender page.

The quiz's exit button is a 44 px round surface button with the filled
`close` icon; a bare hairline cross was too easy to miss.

Progress bars use `--wq-color-progress-track` for the unfilled part; the
lighter `surface-secondary` disappeared on the page background.

### A solid button never goes inside an `ion-toolbar`

For a solid button in a toolbar, Ionic paints the **label** in the toolbar's
own background colour (`--ion-toolbar-background`), assuming the button sits
on a coloured bar. This design system makes toolbars transparent, so the label
became invisible. Full-width primary actions therefore live in a plain
container inside `ion-footer` (see the quiz setup page), not in a toolbar.

### Screens without a header keep clear of the notch

The quiz screens have no `ion-header` to reserve the status bar area, so their
page container adds `var(--ion-safe-area-top)` to its top padding.

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

## Motion, sound and haptics

Three small signals, all of them optional and all of them saying the same
thing the screen already says — never the only carrier of information.

**Motion.** Two animations, both short (`--wq-duration-base`, 220 ms) and
both on arrival, never on departure: the answer's verdict rises into place
where the choices were, and the blocks of the result screen appear from the
top down (0 ms, 60 ms, 110 ms, then 160 ms for the rest) so the eye reads
the score first. Everything else is Ionic's own page transition. The base
styles turn all of it off under `prefers-reduced-motion`.

**Sound** (`libs/client/feedback`). Two-note tones made with the Web Audio
API — no audio files to download, decode or ship in the app bundle: a rising
third for a correct answer, one low note for a wrong one (information, not
punishment), a short fanfare for a perfect run, an achievement or a record.
Quiet by design (`0.12` peak gain, 90 ms per note) and faded in and out so
the speaker does not click.

**Haptics.** The iPhone only: iOS separates an _impact_ (something was
touched) from a _notification_ (something succeeded or failed), and the app
follows that — a light tap for a correct answer, a warning for a wrong one,
a success pattern at the end of a perfect run. A browser has no taptic
engine, so there is nothing there and the setting is hidden.

**The player decides.** Settings → Sound and feel has a switch for each
channel; they are independent, so the taps can stay while the sound goes.
Both default to on, and a failure in either (a browser that refuses to play
before a gesture, a device without an engine) is swallowed: a quiz must
never break because a sound did not play.
