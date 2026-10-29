import { Router } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { fireEvent, render, screen } from '@testing-library/angular';
import { provideShellTesting } from '../../testing/shell-testing';
import { ProgressStore } from '@world-quiz/client/progress';
import { finishedSession } from '@world-quiz/client/progress/testing';
import { QuizSetupPage } from './setup.page';
import { TIPS_STORAGE_KEY, type TipId, TipsStore } from '../core/tips.store';

function emitIonChange(element: Element, value: unknown) {
  element.dispatchEvent(new CustomEvent('ionChange', { detail: { value } }));
}

/**
 * Renders the screen as a player who has already been through its guided
 * tour — which is how it is seen every time but the first. The tests of the
 * tour itself pass `seenTips: []`.
 */
async function renderSetup({
  seenTips = ['setup'] as readonly TipId[],
  ...inputs
}: { category?: string; mode?: string; seenTips?: readonly TipId[] } = {}) {
  const view = await render(QuizSetupPage, {
    inputs,
    providers: provideShellTesting({
      storage: { [TIPS_STORAGE_KEY]: JSON.stringify(seenTips) },
    }),
  });
  await TestBed.inject(TipsStore).load();
  view.fixture.detectChanges();
  const router = TestBed.inject(Router);
  const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
  return { ...view, navigate };
}

describe('QuizSetupPage', () => {
  it('offers every region, difficulty and mode from the domain', async () => {
    await renderSetup();

    for (const [scope, name] of [
      ['world', 'World'],
      ['europe', 'Europe'],
      ['asia', 'Asia'],
      ['africa', 'Africa'],
      ['oceania', 'Oceania'],
    ]) {
      const option = await screen.findByTestId(`setup-scope-${scope}`);
      expect(option.textContent).toContain(name);
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

  // How long a round will be is part of choosing a region: "Europe (44)"
  // answers it before the quiz starts. The bare number means nothing to a
  // screen reader, so the button's label spells it out.
  it('says how many countries each region has', async () => {
    await renderSetup();
    const dataset = TestBed.inject(ProgressStore).dataset;
    const inEurope = dataset.filter(
      (country) => country.region === 'europe',
    ).length;

    const world = await screen.findByTestId('setup-scope-world');
    const europe = screen.getByTestId('setup-scope-europe');

    expect(world.textContent).toContain(`(${dataset.length})`);
    expect(europe.textContent).toContain(`(${inEurope})`);
    expect(europe.getAttribute('aria-label')).toMatch(
      new RegExp(`^Europe, ${inEurope} countr(y|ies)$`),
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

  it('preselects the category passed in the link and starts that quiz', async () => {
    const { navigate } = await renderSetup({ category: 'flags' });

    const segment = (await screen.findByTestId(
      'setup-category',
    )) as HTMLElement & { value?: string };
    expect(segment.value).toBe('flags');

    fireEvent.click(screen.getByTestId('setup-start'));
    expect(navigate).toHaveBeenCalledWith(['/quiz', 'flags'], {
      queryParams: expect.objectContaining({ mode: 'fixed' }),
    });
  });

  it('falls back to Capitals for an unknown category and lets the player switch', async () => {
    const { navigate } = await renderSetup({ category: 'rivers' });

    emitIonChange(await screen.findByTestId('setup-category'), 'flags');
    fireEvent.click(screen.getByTestId('setup-start'));

    expect(navigate).toHaveBeenCalledWith(
      ['/quiz', 'flags'],
      expect.anything(),
    );
  });

  describe('Practice Mistakes', () => {
    /** Mistakes: France (Europe) and Japan (Asia) in Capitals. */
    const recordMistakes = () =>
      TestBed.inject(ProgressStore).recordSession(
        finishedSession([
          { code: 'fr', correct: false },
          { code: 'jp', correct: false },
        ]),
      );

    it('is offered only when there is something to practise', async () => {
      const { fixture } = await renderSetup({ mode: 'practice' });
      const practice = (await screen.findByTestId(
        'setup-mode-practice',
      )) as HTMLButtonElement;
      expect(practice.disabled).toBe(true);
      expect(
        (
          screen.getByTestId('setup-start') as HTMLElement & {
            disabled: boolean;
          }
        ).disabled,
      ).toBe(true);

      recordMistakes();
      fixture.detectChanges();

      expect(practice.disabled).toBe(false);
      expect(practice.textContent).toContain('Countries to review: 2');
    });

    it('counts the mistakes of the chosen region, and starts the round', async () => {
      const { navigate, fixture } = await renderSetup({ mode: 'practice' });
      recordMistakes();

      fireEvent.click(await screen.findByTestId('setup-scope-europe'));
      fixture.detectChanges();
      expect(screen.getByTestId('setup-mode-practice').textContent).toContain(
        'Countries to review: 1',
      );
      fireEvent.click(screen.getByTestId('setup-start'));

      expect(navigate).toHaveBeenCalledWith(['/quiz', 'capitals'], {
        queryParams: { scope: 'europe', difficulty: 'easy', mode: 'practice' },
      });
    });
  });

  // The point of this screen is easy to miss: a player can arrive with
  // everything already chosen and press Start.
  describe('the guided tour', () => {
    const sectionOf = (tour: string) =>
      document.querySelector(`[data-tour="${tour}"]`) as HTMLElement;

    it('walks the four choices, one at a time, and lets the quiz start after', async () => {
      const { fixture } = await renderSetup({ seenTips: [] });

      // Every other section waits: blurred, and out of reach of taps, the
      // Tab key and the screen reader.
      await screen.findByTestId('tour-step');
      expect(sectionOf('category').className).not.toContain('wq-tour-aside');
      expect(sectionOf('scope').className).toContain('wq-tour-aside');
      expect(sectionOf('scope').hasAttribute('inert')).toBe(true);
      // The quiz cannot be started yet: the tour stands where Start does.
      expect(screen.queryByTestId('setup-start')).toBeNull();

      for (const step of ['scope', 'difficulty', 'mode']) {
        fireEvent.click(screen.getByTestId('tour-next'));
        fixture.detectChanges();
        expect(sectionOf(step).className).not.toContain('wq-tour-aside');
        expect(sectionOf(step).hasAttribute('inert')).toBe(false);
      }

      fireEvent.click(screen.getByTestId('tour-next'));
      fixture.detectChanges();

      expect(screen.queryByTestId('tour-step')).toBeNull();
      expect(sectionOf('category').className).not.toContain('wq-tour-aside');
      expect(screen.getByTestId('setup-start')).toBeTruthy();
      expect(TestBed.inject(TipsStore).shows('setup')).toBe(false);
    });

    it('says which step the player is on', async () => {
      const { fixture } = await renderSetup({ seenTips: [] });

      expect((await screen.findByTestId('tour-text')).textContent).toContain(
        'Start with the quiz type',
      );
      expect(screen.getByLabelText('Step 1 of 4')).toBeTruthy();

      fireEvent.click(screen.getByTestId('tour-next'));
      fixture.detectChanges();

      expect(screen.getByTestId('tour-text').textContent).toContain(
        'Now the region',
      );
      expect(screen.getByLabelText('Step 2 of 4')).toBeTruthy();
    });

    // Choosing is what the tour asks for, so it must not end the tour.
    it('stays while the player makes the choice it is explaining', async () => {
      const { fixture } = await renderSetup({ seenTips: [] });
      await screen.findByTestId('tour-step');

      emitIonChange(screen.getByTestId('setup-category'), 'flags');
      fixture.detectChanges();

      expect(screen.getByTestId('tour-step')).toBeTruthy();
    });

    it('is not shown to a player who has already been through it', async () => {
      const { fixture } = await renderSetup();
      fixture.detectChanges();

      expect(screen.queryByTestId('tour-step')).toBeNull();
      expect(screen.getByTestId('setup-start')).toBeTruthy();
    });
  });
});
