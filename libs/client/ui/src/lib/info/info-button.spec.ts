import { render, screen } from '@testing-library/angular';
import { InfoButton } from './info-button';

const renderButton = () =>
  render(InfoButton, {
    inputs: {
      text: 'Short tones when an answer lands.',
      label: 'About Sounds',
    },
  });

/** Ionic's popover is not upgraded in jsdom, so its inputs are properties. */
const popover = () =>
  document.querySelector('ion-popover') as HTMLElement & {
    isOpen?: boolean;
    event?: Event;
  };

describe('InfoButton', () => {
  it('is a labelled button, not a bare icon', async () => {
    await renderButton();

    expect(screen.getByRole('button', { name: 'About Sounds' })).toBeTruthy();
  });

  it('keeps the note away until it is asked for', async () => {
    await renderButton();

    expect(popover().isOpen).toBe(false);
    expect(screen.queryByTestId('info-note')).toBeNull();
  });

  it('opens the note where the player pressed', async () => {
    const { fixture } = await renderButton();

    screen.getByTestId('info-button').click();
    fixture.detectChanges();

    expect(popover().isOpen).toBe(true);
    // Ionic points the popover at the click, the way iOS does.
    expect(popover().event).toBeInstanceOf(Event);
  });
});
