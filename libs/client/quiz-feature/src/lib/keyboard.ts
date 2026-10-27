import { DestroyRef, inject, signal, type Signal } from '@angular/core';

/** How much of the window has to disappear before it counts as a keyboard. */
const KEYBOARD_MIN_INSET_PX = 120;

/**
 * Whether an on-screen keyboard is covering part of the window.
 *
 * iOS does not shrink the layout viewport when the keyboard opens: `svh`,
 * `vh` and every CSS media query stay exactly as they were, so a stylesheet
 * cannot see it. `visualViewport` can — it reports the part of the page that
 * is still visible — and the difference between the two is the keyboard.
 *
 * It is a *late* signal: measured on an iPhone, iOS decides how far to push
 * the page up while the keyboard opens, and the resize arrives after that
 * decision. A layout that has to be ready in time cannot wait for this one.
 *
 * Call it in an injection context: the listener goes away with the caller.
 */
export function keyboardOpen(): Signal<boolean> {
  const open = signal(false);
  const viewport = globalThis.visualViewport;
  if (!viewport) return open.asReadonly();

  const update = () =>
    open.set(window.innerHeight - viewport.height > KEYBOARD_MIN_INSET_PX);
  update();
  viewport.addEventListener('resize', update);
  inject(DestroyRef).onDestroy(() =>
    viewport.removeEventListener('resize', update),
  );
  return open.asReadonly();
}
