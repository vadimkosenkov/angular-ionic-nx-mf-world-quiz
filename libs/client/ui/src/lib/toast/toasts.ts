import { inject, Injectable, InjectionToken, signal } from '@angular/core';

/** What a toast says about the action it reports. */
export type ToastTone = 'success' | 'error';

export interface Toast {
  /**
   * Counts up with every message. The host renders a **new element** per id,
   * which is what makes a screen reader announce it (see `ToastHost`).
   */
  readonly id: number;
  /** Already translated: `client/ui` holds no translations. */
  readonly text: string;
  readonly tone: ToastTone;
}

/** Hides the toast after a while; the returned function cancels that. */
export type ToastScheduler = (task: () => void, delayMs: number) => () => void;

/** Replaced in tests, so a message stays until the test is done with it. */
export const TOAST_SCHEDULER = new InjectionToken<ToastScheduler>(
  'TOAST_SCHEDULER',
  {
    providedIn: 'root',
    factory: () => (task, delayMs) => {
      const handle = setTimeout(task, delayMs);
      return () => clearTimeout(handle);
    },
  },
);

/**
 * How long each tone stays on screen. A failure gets longer: it carries a
 * longer sentence and often asks the player to do something about it.
 */
export const TOAST_DURATION_MS: Record<ToastTone, number> = {
  success: 3000,
  error: 5000,
};

/**
 * The app's one way of saying that something just went well or wrong.
 *
 * It holds a single message: a second one replaces the first rather than
 * queueing behind it, because these report the action the player performed a
 * moment ago and a queue would show them a message about something they have
 * already moved on from. Standing facts about a screen — an empty board, a
 * result the server refused, no connection — belong on that screen, not here
 * (docs/architecture/design-system.md).
 */
@Injectable({ providedIn: 'root' })
export class Toasts {
  private readonly scheduleHide = inject(TOAST_SCHEDULER);

  private readonly state = signal<Toast | null>(null);
  private cancelHide: (() => void) | null = null;
  private lastId = 0;

  /** The message showing now, if any. */
  readonly current = this.state.asReadonly();

  /** An action did what the player asked. */
  success(text: string): void {
    this.show(text, 'success');
  }

  /** An action did not work, in words that say what to do next. */
  failure(text: string): void {
    this.show(text, 'error');
  }

  dismiss(): void {
    this.cancelHide?.();
    this.cancelHide = null;
    this.state.set(null);
  }

  private show(text: string, tone: ToastTone): void {
    this.cancelHide?.();
    this.state.set({ id: ++this.lastId, text, tone });
    this.cancelHide = this.scheduleHide(
      () => this.dismiss(),
      TOAST_DURATION_MS[tone],
    );
  }
}
