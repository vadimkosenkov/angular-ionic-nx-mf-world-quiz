import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import { ToastHost } from './toast-host';
import { TOAST_SCHEDULER, Toasts, type ToastScheduler } from './toasts';

/** Never hides by itself, so a test sees what it rendered. */
const neverHides: ToastScheduler = () => () => undefined;

async function renderHost() {
  const rendered = await render(ToastHost, {
    inputs: { dismissLabel: 'Close message' },
    providers: [{ provide: TOAST_SCHEDULER, useValue: neverHides }],
  });
  return { ...rendered, toasts: TestBed.inject(Toasts) };
}

describe('ToastHost', () => {
  it('shows nothing while there is no message', async () => {
    await renderHost();
    expect(screen.queryByTestId('toast')).toBeNull();
  });

  it('announces a confirmation politely', async () => {
    const { toasts, detectChanges } = await renderHost();

    toasts.success('Your public name is saved.');
    detectChanges();

    const toast = screen.getByRole('status');
    expect(toast.textContent).toContain('Your public name is saved.');
    expect(toast.classList.contains('error')).toBe(false);
  });

  it('announces a failure as an alert', async () => {
    const { toasts, detectChanges } = await renderHost();

    toasts.failure('The name could not be saved.');
    detectChanges();

    const toast = screen.getByRole('alert');
    expect(toast.textContent).toContain('The name could not be saved.');
    // The tone's colour; the icon beside it is decorative, and Ionic's icon
    // element does not upgrade in jsdom to be asked what it is showing.
    expect(toast.classList.contains('error')).toBe(true);
  });

  it('gives every message its own element, so each one is announced', async () => {
    const { toasts, detectChanges } = await renderHost();

    toasts.success('Saved');
    detectChanges();
    const first = screen.getByTestId('toast');

    toasts.success('Saved again');
    detectChanges();

    expect(screen.getByTestId('toast')).not.toBe(first);
  });

  it('puts the message away when the player closes it', async () => {
    const { toasts, detectChanges } = await renderHost();
    toasts.failure('Not saved');
    detectChanges();

    screen.getByRole('button', { name: 'Close message' }).click();
    detectChanges();

    expect(toasts.current()).toBeNull();
    expect(screen.queryByTestId('toast')).toBeNull();
  });
});
