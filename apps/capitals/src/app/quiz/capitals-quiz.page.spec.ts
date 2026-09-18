import { fireEvent, render, screen } from '@testing-library/angular';
import { provideQuizTesting } from '@world-quiz/client/quiz-feature/testing';
import {
  QUIZ_RESULT_SINK,
  type QuizResultSink,
  type QuizSessionOutcome,
} from '@world-quiz/client/quiz-ports';
import type { QuizSession, SessionSummary } from '@world-quiz/quiz/domain';
import { FIXTURE_DATASET } from '@world-quiz/quiz/domain/testing';
import { CapitalsQuizPage } from './capitals-quiz.page';

/** Records what the remote hands to the host. */
class RecordingSink implements QuizResultSink {
  readonly submissions: { session: QuizSession; summary: SessionSummary }[] =
    [];

  submit(session: QuizSession, summary: SessionSummary): QuizSessionOutcome {
    this.submissions.push({ session, summary });
    return { newlyUnlocked: [], mistakes: [] };
  }
}

async function renderPage(sink: RecordingSink, query: Record<string, string>) {
  return render(CapitalsQuizPage, {
    inputs: query,
    providers: [
      ...provideQuizTesting(),
      { provide: QUIZ_RESULT_SINK, useValue: sink },
    ],
  });
}

/** Answers the visible question correctly and acknowledges the feedback. */
function answerCorrectly(): void {
  const name = screen.getByTestId('quiz-country').textContent?.trim();
  const country = FIXTURE_DATASET.find((entry) => entry.name.en === name);
  if (!country) throw new Error(`Unknown country in prompt: "${name}"`);
  fireEvent.click(screen.getByTestId(`quiz-choice-${country.code}`));
  fireEvent.click(screen.getByTestId('quiz-continue'));
}

describe('CapitalsQuizPage', () => {
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
});
