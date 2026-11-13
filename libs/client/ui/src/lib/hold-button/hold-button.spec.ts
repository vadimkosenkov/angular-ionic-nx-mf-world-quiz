import { Component, signal } from '@angular/core';
import { fireEvent, render, screen } from '@testing-library/angular';
import { HoldButton } from './hold-button';

/** A host, because the words of the button are projected into it. */
@Component({
  imports: [HoldButton],
  template: `
    <wq-hold-button
      [hint]="'Press and hold until the bar is full.'"
      [duration]="100"
      [disabled]="off()"
      (held)="held.set(held() + 1)"
    >
      Delete permanently
    </wq-hold-button>
  `,
})
class Host {
  readonly off = signal(false);
  readonly held = signal(0);
}

const renderButton = () => render(Host);

const button = () => screen.getByTestId('hold-button');

/** Long enough for a hold of 100 ms to have finished, or not to have. */
const after = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('HoldButton', () => {
  it('says what it does and how it is worked', async () => {
    await renderButton();

    expect(button().textContent).toContain('Delete permanently');
    expect(
      screen.getByText('Press and hold until the bar is full.'),
    ).toBeTruthy();
    // The hint is the button's description, not a stray line of text.
    const describedBy = button().getAttribute('aria-describedby');
    expect(document.getElementById(describedBy ?? '')?.textContent).toContain(
      'Press and hold',
    );
  });

  it('does nothing on a press that does not last', async () => {
    const { fixture } = await renderButton();

    fireEvent.pointerDown(button());
    await after(40);
    fireEvent.pointerUp(button());
    await after(120);

    expect(fixture.componentInstance.held()).toBe(0);
  });

  it('acts once the press has lasted', async () => {
    const { fixture } = await renderButton();

    fireEvent.pointerDown(button());
    await after(160);

    expect(fixture.componentInstance.held()).toBe(1);
  });

  it('is worked from a keyboard the same way', async () => {
    const { fixture } = await renderButton();

    fireEvent.keyDown(button(), { key: ' ' });
    // A held key repeats; the repeats must not start a second hold.
    fireEvent.keyDown(button(), { key: ' ', repeat: true });
    await after(160);

    expect(fixture.componentInstance.held()).toBe(1);
  });

  it('gives up the hold when the finger leaves the button', async () => {
    const { fixture } = await renderButton();

    fireEvent.pointerDown(button());
    fireEvent.pointerLeave(button());
    await after(160);

    expect(fixture.componentInstance.held()).toBe(0);
  });

  it('cannot be held while it is disabled', async () => {
    const { fixture } = await renderButton();
    fixture.componentInstance.off.set(true);
    fixture.detectChanges();

    fireEvent.pointerDown(button());
    await after(160);

    expect(fixture.componentInstance.held()).toBe(0);
  });
});
