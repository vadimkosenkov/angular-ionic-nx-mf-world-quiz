import { Router } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { fireEvent, render, screen } from '@testing-library/angular';
import { provideShellTesting } from '../../testing/shell-testing';
import { ProgressStore } from '@world-quiz/client/progress';
import { finishedSession } from '@world-quiz/client/progress/testing';
import { QuizSetupPage } from './setup.page';
import {
  DEFAULT_SETUP,
  LAST_SETUP_STORAGE_KEY,
  LastSetupStore,
  type RememberedSetup,
} from '../core/last-setup.store';
import { TIPS_STORAGE_KEY, type TipId, TipsStore } from '../core/tips.store';
import { type FeedbackEvent, TONES } from '@world-quiz/client/feedback';

/**
 * Renders the screen as a player who has already been through its guided
 * tour — which is how it is seen every time but the first. The tests of the
 * tour itself pass `seenTips: []`.
 */
async function renderSetup({
  seenTips = ['setup'] as readonly TipId[],
  lastSetup,
  ...inputs
}: {
  category?: string;
  mode?: string;
  seenTips?: readonly TipId[];
  /** The setup this device remembers, as if a quiz had been started. */
  lastSetup?: RememberedSetup;
} = {}) {
  // What the screen played, so a test can check that starting a quiz sounds
  // like starting something.
  const played: FeedbackEvent[] = [];
  const view = await render(QuizSetupPage, {
    inputs,
    providers: [
      {
        provide: TONES,
        useValue: {
          play: (event: FeedbackEvent) => {
            played.push(event);
            return Promise.resolve();
          },
        },
      },
      ...provideShellTesting({
        storage: {
          [TIPS_STORAGE_KEY]: JSON.stringify(seenTips),
          ...(lastSetup
            ? { [LAST_SETUP_STORAGE_KEY]: JSON.stringify(lastSetup) }
            : {}),
        },
      }),
    ],
  });
  await TestBed.inject(TipsStore).load();
  await TestBed.inject(LastSetupStore).load();
  view.fixture.detectChanges();
  const router = TestBed.inject(Router);
  const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
  return { ...view, navigate, played };
}

describe('QuizSetupPage', () => {
  // Sound is the only sign that the press did something: the quiz screen
  // takes a moment to arrive, and in the app it comes with a taptic tap.
  it('sounds like starting something when a quiz starts', async () => {
    const { played } = await renderSetup();

    fireEvent.click(await screen.findByTestId('setup-start'));

    expect(played).toEqual(['start']);
  });

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
    fireEvent.click(screen.getByTestId('setup-difficulty-hard'));
    fireEvent.click(screen.getByTestId('setup-mode-timed'));
    fireEvent.click(screen.getByTestId('setup-start'));

    expect(navigate).toHaveBeenCalledWith(['/quiz', 'capitals'], {
      queryParams: { scope: 'europe', difficulty: 'hard', mode: 'timed' },
    });
  });

  // "Easy" and "Hard" say nothing about what the player is choosing; the
  // difference is how an answer is given, and the tile says so.
  it('says what each difficulty means', async () => {
    await renderSetup();

    expect(
      (await screen.findByTestId('setup-difficulty-easy')).textContent,
    ).toContain('Pick from four possible answers');
    expect(screen.getByTestId('setup-difficulty-hard').textContent).toContain(
      'Type or dictate the answer',
    );
  });

  it('preselects the category passed in the link and starts that quiz', async () => {
    const { navigate } = await renderSetup({ category: 'flags' });

    const flags = await screen.findByTestId('setup-category-flags');
    expect(flags.getAttribute('aria-pressed')).toBe('true');
    expect(
      screen
        .getByTestId('setup-category-capitals')
        .getAttribute('aria-pressed'),
    ).toBe('false');

    fireEvent.click(screen.getByTestId('setup-start'));
    expect(navigate).toHaveBeenCalledWith(['/quiz', 'flags'], {
      queryParams: expect.objectContaining({ mode: 'fixed' }),
    });
  });

  it('falls back to Capitals for an unknown category and lets the player switch', async () => {
    const { navigate } = await renderSetup({ category: 'rivers' });

    fireEvent.click(await screen.findByTestId('setup-category-flags'));
    fireEvent.click(screen.getByTestId('setup-start'));

    expect(navigate).toHaveBeenCalledWith(
      ['/quiz', 'flags'],
      expect.anything(),
    );
  });

  // The category is a tile rather than a word in a segment: it says what
  // the quiz asks for, and how far the player already is in it.
  it('describes each category and how much of it is mastered', async () => {
    await renderSetup();

    const capitals = await screen.findByTestId('setup-category-capitals');
    expect(capitals.textContent).toContain('Name the capital of each country');
    expect(capitals.textContent).toContain('0/195 mastered');
    expect(screen.getByTestId('setup-category-flags').textContent).toContain(
      'Recognize every country by its flag',
    );
  });

  // Home has one Play button now, so this screen is where a player lands
  // every time: it has to arrive already saying what they play.
  describe('the setup the device remembers', () => {
    it('opens with every choice where the player left it', async () => {
      await renderSetup({
        lastSetup: {
          category: 'flags',
          scope: 'africa',
          difficulty: 'hard',
          mode: 'timed',
        },
      });

      expect(
        (await screen.findByTestId('setup-category-flags')).getAttribute(
          'aria-pressed',
        ),
      ).toBe('true');
      expect(
        screen.getByTestId('setup-scope-africa').getAttribute('aria-pressed'),
      ).toBe('true');
      expect(
        screen.getByTestId('setup-mode-timed').getAttribute('aria-pressed'),
      ).toBe('true');
      expect(
        screen
          .getByTestId('setup-difficulty-hard')
          .getAttribute('aria-pressed'),
      ).toBe('true');
    });

    it('remembers the choices the player started a quiz with', async () => {
      await renderSetup();

      fireEvent.click(await screen.findByTestId('setup-category-flags'));
      fireEvent.click(screen.getByTestId('setup-scope-europe'));
      fireEvent.click(screen.getByTestId('setup-difficulty-hard'));
      fireEvent.click(screen.getByTestId('setup-mode-endless'));
      fireEvent.click(screen.getByTestId('setup-start'));

      expect(TestBed.inject(LastSetupStore).setup()).toEqual({
        category: 'flags',
        scope: 'europe',
        difficulty: 'hard',
        mode: 'endless',
      });
    });

    // Practice Mistakes needs mistakes to exist. Remembering it would hand
    // the player a screen whose Start button is disabled.
    it('keeps the training mode when the round was Practice Mistakes', async () => {
      await renderSetup({ mode: 'practice' });
      TestBed.inject(ProgressStore).recordSession(
        finishedSession([{ code: 'fr', correct: false }]),
      );

      fireEvent.click(await screen.findByTestId('setup-scope-europe'));
      fireEvent.click(screen.getByTestId('setup-start'));

      expect(TestBed.inject(LastSetupStore).setup()).toEqual({
        ...DEFAULT_SETUP,
        scope: 'europe',
      });
    });
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
    const spotlight = () =>
      document.querySelector('wq-tour-spotlight') as HTMLElement;

    /**
     * The tour appears where its section has come to rest, which takes a
     * few frames to establish (`whenArrived`): one to notice the new
     * section, one to see it standing still, one to render.
     */
    const settle = async (fixture: { detectChanges(): void }) => {
      for (let frame = 0; frame < 3; frame += 1) {
        await new Promise((resolve) =>
          requestAnimationFrame(() => setTimeout(resolve)),
        );
        fixture.detectChanges();
      }
    };

    /**
     * jsdom lays nothing out, so every section would be at the same place:
     * each gets one of its own.
     */
    const placeSections = async (fixture: { detectChanges(): void }) => {
      ['category', 'scope', 'difficulty', 'mode'].forEach((tour, index) => {
        const top = 100 * (index + 1);
        sectionOf(tour).getBoundingClientRect = () =>
          ({ left: 0, top, right: 300, bottom: top + 60 }) as DOMRect;
      });
      await settle(fixture);
    };

    it('walks the four choices, one at a time, and lets the quiz start after', async () => {
      const { fixture } = await renderSetup({ seenTips: [] });

      // Every other section waits out of reach of taps, the Tab key and the
      // screen reader, and the screen is dimmed except this one.
      await screen.findByTestId('tour-step');
      await placeSections(fixture);
      // The window of the clip path starts on the section's top edge,
      // a corner's width in: the section, with room left around it.
      expect(spotlight().style.clipPath).toContain('M24,88');
      expect(sectionOf('scope').hasAttribute('inert')).toBe(true);
      expect(sectionOf('category').hasAttribute('inert')).toBe(false);
      // The quiz cannot be started yet: the tour stands where Start does.
      expect(screen.queryByTestId('setup-start')).toBeNull();

      for (const [index, step] of ['scope', 'difficulty', 'mode'].entries()) {
        fireEvent.click(screen.getByTestId('tour-next'));
        await settle(fixture);
        expect(sectionOf(step).hasAttribute('inert')).toBe(false);
        // The lit window moved on to this step's own section.
        expect(spotlight().style.clipPath).toContain(
          `M24,${100 * (index + 2) - 12}`,
        );
      }

      fireEvent.click(screen.getByTestId('tour-next'));
      fixture.detectChanges();

      expect(screen.queryByTestId('tour-step')).toBeNull();
      expect(spotlight()).toBeNull();
      expect(sectionOf('category').hasAttribute('inert')).toBe(false);
      expect(screen.getByTestId('setup-start')).toBeTruthy();
      expect(TestBed.inject(TipsStore).shows('setup')).toBe(false);
    });

    it('says which step the player is on', async () => {
      const { fixture } = await renderSetup({ seenTips: [] });

      await screen.findByTestId('tour-text');
      await placeSections(fixture);
      expect(screen.getByTestId('tour-text').textContent).toContain(
        'Start with the quiz type',
      );
      expect(screen.getByLabelText('Step 1 of 4')).toBeTruthy();

      // The card says the next thing only once it stands beside it.
      fireEvent.click(screen.getByTestId('tour-next'));
      await settle(fixture);

      expect(screen.getByTestId('tour-text').textContent).toContain(
        'Now the region',
      );
      expect(screen.getByLabelText('Step 2 of 4')).toBeTruthy();
    });

    // Choosing is what the tour asks for, so it must not end the tour.
    it('stays while the player makes the choice it is explaining', async () => {
      const { fixture } = await renderSetup({ seenTips: [] });
      await screen.findByTestId('tour-step');

      fireEvent.click(screen.getByTestId('setup-category-flags'));
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
