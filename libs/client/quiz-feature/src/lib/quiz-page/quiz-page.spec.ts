import { NavController } from '@ionic/angular';
import { fireEvent, render, screen } from '@testing-library/angular';
import { provideQuizTesting } from '../../testing/quiz-testing';
import {
  QUIZ_RESULT_SINK,
  type QuizResultSink,
  type QuizSessionOutcome,
} from '@world-quiz/client/quiz-ports';
import { FIXTURE_DATASET } from '@world-quiz/quiz/domain/testing';
import type { RankedOutcome } from '@world-quiz/shared/contracts';
import {
  DEFAULT_FIXED_QUESTION_COUNT,
  evaluateRankedRun,
  type QuizCategory,
  type QuizSession,
  type SessionSummary,
} from '@world-quiz/quiz/domain';
import { QuizPage } from './quiz-page';

/** Records what the remote hands to the host. */
class RecordingSink implements QuizResultSink {
  readonly submissions: {
    session: QuizSession;
    summary: SessionSummary;
  }[] = [];
  /** What the host answers for a run that can reach a board. */
  place: Promise<RankedOutcome | null> = Promise.resolve(null);

  submit(session: QuizSession, summary: SessionSummary): QuizSessionOutcome {
    this.submissions.push({ session, summary });
    return {
      newlyUnlocked: [],
      mistakes: [],
      // Exactly what the shell does: only a run that can be ranked waits.
      ...(evaluateRankedRun(session, summary).eligible
        ? { ranked: this.place }
        : {}),
    };
  }
}

/** Lets the host's answer arrive and the page render it. */
async function settle(fixture: { detectChanges(): void }) {
  await new Promise((resolve) => setTimeout(resolve));
  fixture.detectChanges();
}

async function renderPage(
  sink: RecordingSink,
  query: Record<string, string>,
  category: QuizCategory = 'capitals',
  mistakes: Record<string, readonly string[]> = {},
) {
  return render(QuizPage, {
    inputs: { category, ...query },
    providers: [
      ...provideQuizTesting({ mistakes }),
      { provide: QUIZ_RESULT_SINK, useValue: sink },
    ],
  });
}

/** Answers the visible question correctly and acknowledges the feedback. */
function answerCorrectly(): void {
  const code = screen.getByTestId('quiz-prompt').dataset['countryCode'];
  fireEvent.click(screen.getByTestId(`quiz-choice-${code}`));
  fireEvent.click(screen.getByTestId('quiz-continue'));
}

describe('QuizPage', () => {
  it('builds the quiz from the query parameters', async () => {
    await renderPage(new RecordingSink(), {
      scope: 'europe',
      difficulty: 'easy',
      mode: 'fixed',
      count: '2',
    });

    expect((await screen.findByTestId('quiz-position')).textContent).toContain(
      'Question 1 of 2',
    );
  });

  it('falls back to the defaults for unknown parameters', async () => {
    await renderPage(new RecordingSink(), {
      scope: 'atlantis',
      difficulty: 'impossible',
      mode: 'marathon',
    });

    expect((await screen.findByTestId('quiz-position')).textContent).toContain(
      'Question 1 of 10',
    );
    expect(screen.getByTestId('quiz-choices')).toBeTruthy();
  });

  it.each(['0', '-3', '2.5', 'ten'])(
    'uses the default length for ?count=%s',
    async (count) => {
      await renderPage(new RecordingSink(), { mode: 'fixed', count });

      expect(
        (await screen.findByTestId('quiz-position')).textContent,
      ).toContain('Question 1 of 10');
    },
  );

  it('records nothing when the player leaves mid-quiz', async () => {
    const sink = new RecordingSink();
    const { fixture } = await renderPage(sink, { mode: 'fixed', count: '3' });
    await screen.findByTestId('quiz-prompt');
    answerCorrectly();
    const navigateRoot = vi
      .spyOn(fixture.debugElement.injector.get(NavController), 'navigateRoot')
      .mockResolvedValue(true);

    fireEvent.click(screen.getByTestId('quiz-exit'));

    // A new root, so the quiz does not stay hidden in Ionic's page stack.
    expect(navigateRoot).toHaveBeenCalledWith('/home', {
      animationDirection: 'back',
    });
    expect(sink.submissions).toHaveLength(0);
    expect(screen.queryByTestId('results-score')).toBeNull();
  });

  it('hands the finished session to the host and shows the results', async () => {
    const sink = new RecordingSink();
    await renderPage(sink, { scope: 'world', mode: 'fixed', count: '1' });
    await screen.findByTestId('quiz-prompt');

    answerCorrectly();

    expect(sink.submissions).toHaveLength(1);
    expect(sink.submissions[0]?.summary.correct).toBe(1);
    expect(screen.getByTestId('results-score').textContent).toContain(
      '1 of 1 correct',
    );
  });

  it('starts a new session when playing again', async () => {
    const sink = new RecordingSink();
    await renderPage(sink, { scope: 'world', mode: 'fixed', count: '1' });
    await screen.findByTestId('quiz-prompt');
    answerCorrectly();

    fireEvent.click(screen.getByTestId('results-play-again'));

    expect(screen.getByTestId('quiz-position').textContent).toContain(
      'Question 1 of 1',
    );
    expect(sink.submissions).toHaveLength(1);
  });

  it('plays the category it is given by its route: Flags', async () => {
    const sink = new RecordingSink();
    await renderPage(sink, { mode: 'fixed', count: '1' }, 'flags');

    expect((await screen.findByTestId('quiz-question')).textContent).toContain(
      'Which country does this flag belong to?',
    );
    expect(screen.getByTestId('quiz-flag').getAttribute('alt')).toBe(
      'Flag of the country in question',
    );
    // The answer would give itself away: no country name on a flags question.
    expect(screen.queryByTestId('quiz-country')).toBeNull();

    answerCorrectly();

    expect(sink.submissions[0]?.session.config.category).toBe('flags');
  });

  it('resets once the player has left, so a cached page starts a new quiz', async () => {
    const sink = new RecordingSink();
    const { fixture } = await renderPage(sink, { mode: 'fixed', count: '1' });
    await screen.findByTestId('quiz-prompt');
    answerCorrectly();
    expect(screen.getByTestId('results-score')).toBeTruthy();

    fixture.componentInstance.ionViewDidLeave();
    fixture.detectChanges();

    expect(screen.queryByTestId('results-score')).toBeNull();
    expect(screen.getByTestId('quiz-position').textContent).toContain(
      'Question 1 of 1',
    );
    expect(sink.submissions).toHaveLength(1);
  });

  describe('a place on a public board', () => {
    const playQuickRound = () => {
      for (let i = 0; i < DEFAULT_FIXED_QUESTION_COUNT; i++) answerCorrectly();
    };

    it('waits for the API, then shows the place, the score and a record', async () => {
      const sink = new RecordingSink();
      let answer: (outcome: RankedOutcome) => void = () => undefined;
      sink.place = new Promise((resolve) => (answer = resolve));
      const { fixture } = await renderPage(sink, { mode: 'fixed' });
      await screen.findByTestId('quiz-prompt');
      playQuickRound();

      expect(screen.getByTestId('results-board').textContent).toContain(
        'Checking the board',
      );
      answer({
        board: 'capitals-easy-world-fixed',
        score: 247_300,
        timeMs: 247_300,
        rank: 3,
        players: 48,
        personalRecord: true,
      });
      await settle(fixture);

      // A record is the loud case: the headline is the record itself, with
      // the board it was set on and the two figures under it.
      const board = screen.getByTestId('results-board');
      expect(board.className).toContain('award');
      const card = board.textContent;
      expect(card).toContain('New personal record!');
      expect(card).toContain('Capitals · World · Easy · Quick round');
      expect(screen.getByTestId('results-rank').textContent).toContain(
        '#3 of 48',
      );
      expect(card).toContain('4:07.3');
      // And the record itself can be handed to the share sheet, which is a
      // different picture from the run's.
      expect(screen.getByTestId('results-share-record')).toBeTruthy();
    });

    it('marks a place in the first three with a medal, and stays quiet', async () => {
      const sink = new RecordingSink();
      sink.place = Promise.resolve({
        board: 'capitals-easy-world-fixed',
        score: 247_300,
        timeMs: 247_300,
        rank: 2,
        players: 48,
        personalRecord: false,
      });
      const { fixture } = await renderPage(sink, { mode: 'fixed' });
      await screen.findByTestId('quiz-prompt');
      playQuickRound();
      await settle(fixture);

      const board = screen.getByTestId('results-board');
      expect(board.className).not.toContain('award');
      expect(board.textContent).toContain('Time: 4:07.3');
      expect(
        board.querySelector('ion-icon[data-medal]')?.getAttribute('data-medal'),
      ).toBe('2');
      expect(screen.queryByTestId('results-share-record')).toBeNull();
    });

    it('counts the answers on a board that ranks by them', async () => {
      const sink = new RecordingSink();
      sink.place = Promise.resolve({
        board: 'capitals-easy-world-timed',
        score: 21,
        timeMs: 58_200,
        rank: 1,
        players: 9,
        personalRecord: false,
      });
      const { fixture } = await renderPage(sink, { mode: 'fixed' });
      await screen.findByTestId('quiz-prompt');
      playQuickRound();
      await settle(fixture);

      expect(screen.getByTestId('results-board').textContent).toContain(
        '21 correct in 0:58.2',
      );
    });

    it('says the run has not reached the board when it could not be sent', async () => {
      const { fixture } = await renderPage(new RecordingSink(), {
        mode: 'fixed',
      });
      await screen.findByTestId('quiz-prompt');
      playQuickRound();
      await settle(fixture);

      expect(screen.getByTestId('results-board').textContent).toContain(
        'you are offline',
      );
    });

    it('says nothing about boards after a run that cannot reach one', async () => {
      const sink = new RecordingSink();
      const { fixture } = await renderPage(sink, { mode: 'endless' });
      await screen.findByTestId('quiz-prompt');
      answerCorrectly();
      fireEvent.click(screen.getByTestId('quiz-finish'));
      await settle(fixture);

      expect(screen.queryByTestId('results-board')).toBeNull();
    });
  });

  describe('Practice Mistakes', () => {
    const europe = FIXTURE_DATASET.filter((c) => c.region === 'europe').map(
      (c) => c.code,
    );
    const asia = FIXTURE_DATASET.filter((c) => c.region === 'asia').map(
      (c) => c.code,
    );

    it('plays a Quick round over the mistakes of the chosen region only', async () => {
      const sink = new RecordingSink();
      const mistakes = [asia[0] ?? '', europe[0] ?? '', europe[1] ?? ''];
      await renderPage(
        sink,
        { mode: 'practice', scope: 'europe' },
        'capitals',
        {
          capitals: mistakes,
        },
      );

      expect(
        (await screen.findByTestId('quiz-position')).textContent,
      ).toContain('Question 1 of 2');
      answerCorrectly();
      answerCorrectly();

      expect(sink.submissions[0]?.session.config).toMatchObject({
        mode: 'fixed',
        scope: 'europe',
        questionCount: 2,
        countryCodes: [europe[0], europe[1]],
      });
    });

    it('says there is nothing to review instead of starting an empty quiz', async () => {
      await renderPage(new RecordingSink(), { mode: 'practice' });

      expect(screen.getByTestId('practice-empty').textContent).toContain(
        'Nothing to review',
      );
      expect(screen.queryByTestId('quiz-prompt')).toBeNull();
    });
  });
});
