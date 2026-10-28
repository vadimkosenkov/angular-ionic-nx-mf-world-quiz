import { TestBed } from '@angular/core/testing';
import {
  TOAST_DURATION_MS,
  TOAST_SCHEDULER,
  Toasts,
  type ToastScheduler,
} from './toasts';

interface ScheduledHide {
  readonly delayMs: number;
  readonly run: () => void;
  cancelled: boolean;
}

/** A scheduler the test fires by hand, as the real one fires on a timer. */
function manualScheduler() {
  const hides: ScheduledHide[] = [];
  const schedule: ToastScheduler = (task, delayMs) => {
    const hide: ScheduledHide = { run: task, delayMs, cancelled: false };
    hides.push(hide);
    return () => {
      hide.cancelled = true;
    };
  };
  /** The hide scheduled for the message now showing. */
  const pendingHide = (): ScheduledHide => {
    const hide = hides.at(-1);
    if (!hide) throw new Error('no message was shown');
    return hide;
  };
  return { hides, schedule, pendingHide };
}

function setUp() {
  const scheduler = manualScheduler();
  TestBed.configureTestingModule({
    providers: [{ provide: TOAST_SCHEDULER, useValue: scheduler.schedule }],
  });
  return { ...scheduler, toasts: TestBed.inject(Toasts) };
}

describe('Toasts', () => {
  it('holds nothing until something is said', () => {
    expect(setUp().toasts.current()).toBeNull();
  });

  it.each([
    ['success' as const, 'Your public name is saved.'],
    ['error' as const, 'The name could not be saved.'],
  ])('shows a %s with its text', (tone, text) => {
    const { toasts } = setUp();

    if (tone === 'success') toasts.success(text);
    else toasts.failure(text);

    expect(toasts.current()).toMatchObject({ text, tone });
  });

  it('hides a message when its time is up', () => {
    const { toasts, pendingHide } = setUp();
    toasts.success('Saved');

    expect(pendingHide().delayMs).toBe(TOAST_DURATION_MS.success);
    pendingHide().run();

    expect(toasts.current()).toBeNull();
  });

  it('leaves a failure on screen longer than a confirmation', () => {
    expect(TOAST_DURATION_MS.error).toBeGreaterThan(TOAST_DURATION_MS.success);
  });

  it('replaces the message showing and gives the new one its own id', () => {
    const { toasts, hides, pendingHide } = setUp();
    toasts.success('Saved');
    const first = toasts.current();
    const firstHide = pendingHide();

    toasts.failure('Not saved');

    // The first message's timer must not take the second one away early.
    expect(firstHide.cancelled).toBe(true);
    expect(hides).toHaveLength(2);
    expect(toasts.current()?.text).toBe('Not saved');
    expect(toasts.current()?.id).not.toBe(first?.id);
  });

  it('is dismissed before its time, cancelling the timer', () => {
    const { toasts, pendingHide } = setUp();
    toasts.failure('Not saved');
    const hide = pendingHide();

    toasts.dismiss();

    expect(toasts.current()).toBeNull();
    expect(hide.cancelled).toBe(true);
  });
});
