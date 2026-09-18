import { NavController } from '@ionic/angular';
import { fireEvent, render, screen } from '@testing-library/angular';
import { provideQuizTesting } from '../../testing/quiz-testing';
import {
  QUIZ_RESULT_SINK,
  type QuizResultSink,
  type QuizSessionOutcome,
} from '@world-quiz/client/quiz-ports';
import type {
  QuizCategory,
  QuizSession,
  SessionSummary,
} from '@world-quiz/quiz/domain';
import { QuizPage } from './quiz-page';

/** Records what the remote hands to the host. */
class RecordingSink implements QuizResultSink {
  readonly submissions: { session: QuizSession; summary: SessionSummary }[] =
    [];

  submit(session: QuizSession, summary: SessionSummary): QuizSessionOutcome {
    this.submissions.push({ session, summary });
    return { newlyUnlocked: [], mistakes: [] };
  }
}

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
});
