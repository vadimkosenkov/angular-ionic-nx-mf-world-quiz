import { NavController } from '@ionic/angular';
import { fireEvent, render, screen } from '@testing-library/angular';
import { provideQuizTesting } from '../../testing/quiz-testing';
import {
  QUIZ_RESULT_SINK,
  type QuizResultSink,
  type QuizSessionContext,
  type QuizSessionOutcome,
} from '@world-quiz/client/quiz-ports';
import { FIXTURE_DATASET } from '@world-quiz/quiz/domain/testing';
import type { ChallengeOutcome } from '@world-quiz/shared/contracts';
import type {
  QuizCategory,
  QuizSession,
  SessionSummary,
} from '@world-quiz/quiz/domain';
import { QuizPage } from './quiz-page';

/** Records what the remote hands to the host. */
class RecordingSink implements QuizResultSink {
  readonly submissions: {
    session: QuizSession;
    summary: SessionSummary;
    context?: QuizSessionContext;
  }[] = [];
  /** What the host answers for a challenge run. */
  verdict: Promise<ChallengeOutcome | null> = Promise.resolve(null);

  submit(
    session: QuizSession,
    summary: SessionSummary,
    context?: QuizSessionContext,
  ): QuizSessionOutcome {
    this.submissions.push({ session, summary, context });
    return {
      newlyUnlocked: [],
      mistakes: [],
      ...(context?.challengeId ? { challenge: this.verdict } : {}),
    };
  }
}

/** Lets the host's answer arrive and the page render it. */
async function settle(fixture: { detectChanges(): void }) {
  await new Promise((resolve) => setTimeout(resolve));
  fixture.detectChanges();
}

const CHALLENGE = {
  mode: 'challenge',
  difficulty: 'easy',
  challenge: 'b0e5c0de-0000-4000-8000-000000000001',
  seed: 'server-seed',
};

async function renderPage(
  sink: RecordingSink,
  query: Record<string, string>,
  category: QuizCategory = 'capitals',
) {
  return render(QuizPage, {
    inputs: { category, ...query },
    providers: [
      ...provideQuizTesting(),
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

  describe('leaderboard challenge', () => {
    const playAll = () => {
      for (let i = 0; i < FIXTURE_DATASET.length; i++) answerCorrectly();
    };

    it('plays the whole world with the server seed and hands over the challenge id', async () => {
      const sink = new RecordingSink();
      await renderPage(sink, CHALLENGE);

      expect(
        (await screen.findByTestId('quiz-position')).textContent,
      ).toContain(`Question 1 of ${FIXTURE_DATASET.length}`);
      playAll();

      const [submission] = sink.submissions;
      expect(submission?.session.seed).toBe('server-seed');
      expect(submission?.session.config).toEqual({
        category: 'capitals',
        difficulty: 'easy',
        mode: 'challenge',
        scope: 'world',
      });
      expect(submission?.context).toEqual({ challengeId: CHALLENGE.challenge });
    });

    it('shows the server checking the run, then rank and record', async () => {
      const sink = new RecordingSink();
      let answer: (outcome: ChallengeOutcome) => void = () => undefined;
      sink.verdict = new Promise((resolve) => (answer = resolve));
      const { fixture } = await renderPage(sink, CHALLENGE);
      await screen.findByTestId('quiz-prompt');
      playAll();

      expect(screen.getByTestId('results-challenge').textContent).toContain(
        'Checking your run',
      );
      answer({
        board: 'capitals-easy',
        ranked: true,
        completionTimeMs: 247_300,
        personalRecord: true,
        rank: 3,
      });
      await settle(fixture);

      const card = screen.getByTestId('results-challenge').textContent;
      expect(card).toContain('Ranked #3');
      expect(card).toContain('Time: 4:07.3');
      expect(card).toContain('New personal record!');
    });

    it('says why a run is not ranked', async () => {
      const refused = new RecordingSink();
      refused.verdict = Promise.resolve({
        board: 'capitals-easy',
        ranked: false,
        reason: 'late',
        completionTimeMs: 90_000,
        personalRecord: false,
        rank: null,
      });
      const { fixture } = await renderPage(refused, CHALLENGE);
      await screen.findByTestId('quiz-prompt');
      playAll();
      await settle(fixture);

      expect(screen.getByTestId('results-unranked').textContent).toContain(
        'too long after the run',
      );
    });

    it('says so when the run could not be sent', async () => {
      const { fixture } = await renderPage(new RecordingSink(), CHALLENGE);
      await screen.findByTestId('quiz-prompt');
      playAll();
      await settle(fixture);

      expect(screen.getByTestId('results-challenge').textContent).toContain(
        'you are offline',
      );
    });

    it('offers a new challenge from the leaderboard instead of replaying this one', async () => {
      const { fixture } = await renderPage(new RecordingSink(), CHALLENGE);
      await screen.findByTestId('quiz-prompt');
      playAll();
      const navigateRoot = vi
        .spyOn(fixture.debugElement.injector.get(NavController), 'navigateRoot')
        .mockResolvedValue(true);

      const again = screen.getByTestId('results-play-again');
      expect(again.textContent).toContain('New challenge');
      fireEvent.click(again);

      expect(navigateRoot).toHaveBeenCalledWith('/leaderboard', {
        animationDirection: 'back',
      });
    });

    it('is a training quiz without a challenge id and seed', async () => {
      const sink = new RecordingSink();
      await renderPage(sink, { mode: 'challenge', count: '1' });
      await screen.findByTestId('quiz-prompt');

      answerCorrectly();

      expect(sink.submissions[0]?.session.config.mode).toBe('fixed');
      expect(sink.submissions[0]?.context).toBeUndefined();
    });
  });
});
