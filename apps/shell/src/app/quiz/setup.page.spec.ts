import { Router } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { fireEvent, render, screen } from '@testing-library/angular';
import { provideShellTesting } from '../../testing/shell-testing';
import { QuizSetupPage } from './setup.page';

function emitIonChange(element: Element, value: unknown) {
  element.dispatchEvent(new CustomEvent('ionChange', { detail: { value } }));
}

async function renderSetup() {
  const view = await render(QuizSetupPage, {
    providers: provideShellTesting(),
  });
  const router = TestBed.inject(Router);
  const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
  return { ...view, navigate };
}

describe('QuizSetupPage', () => {
  it('offers every region, difficulty and mode from the domain', async () => {
    await renderSetup();

    for (const region of ['World', 'Europe', 'Asia', 'Africa', 'Oceania']) {
      expect(await screen.findByText(region)).toBeTruthy();
    }
    for (const label of ['Easy', 'Hard']) {
      expect(screen.getByText(label)).toBeTruthy();
    }
    for (const mode of ['Quick round', 'Endless', 'Time attack']) {
      expect(screen.getByText(mode)).toBeTruthy();
    }
    expect(screen.getByTestId('setup-mode-fixed').textContent).toContain(
      '10 questions',
    );
  });

  it('starts a World, Easy, fixed quiz by default', async () => {
    const { navigate } = await renderSetup();

    fireEvent.click(await screen.findByTestId('setup-start'));

    expect(navigate).toHaveBeenCalledWith(['/quiz', 'capitals'], {
      queryParams: {
        scope: 'world',
        difficulty: 'easy',
        mode: 'fixed',
        count: 10,
      },
    });
  });

  it('passes the chosen options on and drops the count outside fixed mode', async () => {
    const { navigate } = await renderSetup();

    fireEvent.click(await screen.findByTestId('setup-scope-europe'));
    emitIonChange(screen.getByTestId('setup-difficulty'), 'hard');
    fireEvent.click(screen.getByTestId('setup-mode-timed'));
    fireEvent.click(screen.getByTestId('setup-start'));

    expect(navigate).toHaveBeenCalledWith(['/quiz', 'capitals'], {
      queryParams: { scope: 'europe', difficulty: 'hard', mode: 'timed' },
    });
  });

  it('ignores values that are not part of the domain vocabulary', async () => {
    const { navigate } = await renderSetup();

    emitIonChange(await screen.findByTestId('setup-difficulty'), 'nightmare');
    fireEvent.click(screen.getByTestId('setup-start'));

    expect(navigate).toHaveBeenCalledWith(['/quiz', 'capitals'], {
      queryParams: expect.objectContaining({ difficulty: 'easy' }),
    });
  });

  it('disables the categories that have no microfrontend yet', async () => {
    await renderSetup();

    const flags = (await screen.findByTestId(
      'setup-category-flags',
    )) as HTMLElement & { disabled?: boolean };
    expect(flags.disabled).toBe(true);
    expect(screen.getByTestId('setup-category-capitals')).toBeTruthy();
  });
});
