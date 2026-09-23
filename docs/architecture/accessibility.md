# Accessibility

> Status: ✅ Phase 14a — every screen is checked against WCAG 2.2 A and AA
> in the E2E suite, and the two failures that check found are fixed.

## How it is checked

`apps/shell-e2e/src/e2e/accessibility.cy.ts` runs **axe** (`cypress-axe`)
against the real screens, in the production build: the welcome screen, Home,
quiz setup, the quiz itself in both difficulties, the results, Leaderboard,
Achievements, Settings, a screen in Russian, a screen in the dark theme, and
the three kinds of page on the public site.

The rule set is `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`, and
every violation is printed with the element that caused it
(`apps/shell-e2e/src/support/accessibility.ts`).

**What this does not prove.** axe checks what a machine can decide — names,
roles, contrast, structure — which is roughly a third of the barriers that
matter. It cannot tell whether the reading order makes sense, whether a
label describes what the control does, or whether a quiz is playable with
VoiceOver. Those are checked by hand, and the app is built for them:

- one action per screen in the same place (`.wq-action-bar`);
- every icon-only control has an `aria-label`, every decorative image an
  empty `alt`;
- the answer feedback is a `role="status"`, so it is announced without
  moving the focus;
- progress bars carry `aria-valuetext` in words, not only numbers;
- `prefers-reduced-motion` turns the animations off (global style).

## What the check found

Two real defects, both invisible until axe ran:

| Screen       | Violation                                                                                                                                                    | Fix                                                                                               |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| Settings     | `aria-required-children`: the language chooser was an `ion-list`, whose `role="list"` may only contain list items — it contained a `radiogroup`              | The card is a plain `div` with the same styles; the radio group keeps its own semantics           |
| Achievements | `scrollable-region-focusable`: nothing on the page can be focused, so a keyboard could not reach the scroll area and the list below the fold was unreachable | The list itself takes the focus (`tabindex="0"` + an accessible name) and scrolls with the arrows |

## Keeping it

The checks run with the rest of the E2E suite in CI, so a new screen without
a name, a label or enough contrast fails the pull request. When a rule has
to be waived, waive it in the spec with the reason next to it — never by
lowering the rule set.
