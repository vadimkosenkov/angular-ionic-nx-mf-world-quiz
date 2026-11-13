import { Component, signal } from '@angular/core';
import { fireEvent, render, screen } from '@testing-library/angular';
import { Dialog } from './dialog';

@Component({
  imports: [Dialog],
  template: `
    <button type="button" data-testid="opener" (click)="open.set(true)">
      Open
    </button>
    @if (open()) {
      <wq-dialog
        [title]="'Public name'"
        [tone]="tone()"
        [closeLabel]="closeLabel()"
        [describedBy]="'dialog-text'"
        (dismissed)="open.set(false)"
      >
        <p id="dialog-text">This is how other players see you.</p>
        <button type="button" data-testid="inside">Save</button>
      </wq-dialog>
    }
  `,
})
class Host {
  readonly open = signal(false);
  readonly tone = signal<'neutral' | 'danger'>('neutral');
  readonly closeLabel = signal('Cancel');
}

async function openDialog(set?: (host: Host) => void) {
  const view = await render(Host);
  set?.(view.fixture.componentInstance);
  // A click focuses the button it lands on in a browser; in jsdom it does
  // not, and the dialog has to find something to give the focus back to.
  screen.getByTestId('opener').focus();
  fireEvent.click(screen.getByTestId('opener'));
  view.fixture.detectChanges();
  // The element is moved and focused after the first render.
  await view.fixture.whenStable();
  return view;
}

describe('Dialog', () => {
  it('is a named dialog over the page', async () => {
    await openDialog();

    const dialog = screen.getByRole('dialog', { name: 'Public name' });
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-describedby')).toBe('dialog-text');
  });

  it('is an alert when what it asks about is destructive', async () => {
    await openDialog((host) => host.tone.set('danger'));

    expect(
      screen.getByRole('alertdialog', { name: 'Public name' }),
    ).toBeTruthy();
  });

  /**
   * Ionic's router outlet is its own stacking context below the floating tab
   * bar, so a dialog left inside a page cannot cover the tabs.
   */
  it('leaves the page it was written in, so nothing of the page is above it', async () => {
    await openDialog();

    expect(screen.getByRole('dialog').closest('wq-dialog')?.parentElement).toBe(
      document.body,
    );
  });

  it('takes the focus, and gives it back to whatever opened it', async () => {
    const { fixture } = await openDialog();

    expect(document.activeElement).toBe(screen.getByRole('dialog'));

    fireEvent.click(screen.getByTestId('dialog-close'));
    fixture.detectChanges();

    expect(document.activeElement).toBe(screen.getByTestId('opener'));
  });

  it('closes on the backdrop and on Escape', async () => {
    const { fixture } = await openDialog();

    fireEvent.click(screen.getByTestId('dialog-backdrop'));
    fixture.detectChanges();
    expect(screen.queryByRole('dialog')).toBeNull();

    fireEvent.click(screen.getByTestId('opener'));
    fixture.detectChanges();
    await fixture.whenStable();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    fixture.detectChanges();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  /**
   * A dialog that offers a cancel of its own does not pass `closeLabel`, or
   * the same way out stands on the screen twice.
   */
  it('draws the close button only when it is given a name', async () => {
    const { fixture } = await openDialog((host) => host.closeLabel.set(''));

    expect(screen.queryByTestId('dialog-close')).toBeNull();

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    fixture.detectChanges();
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
