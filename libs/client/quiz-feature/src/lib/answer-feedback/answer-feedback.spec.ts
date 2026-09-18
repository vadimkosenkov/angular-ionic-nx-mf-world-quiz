import { render, screen } from '@testing-library/angular';
import type { AnswerRecord } from '@world-quiz/quiz/domain';
import { provideQuizTesting } from '../../testing/quiz-testing';
import { AnswerFeedback } from './answer-feedback';

const record = (overrides: Partial<AnswerRecord> = {}): AnswerRecord => ({
  questionIndex: 0,
  countryCode: 'fr',
  answer: { kind: 'choice', countryCode: 'fr' },
  correct: true,
  judgement: 'choice',
  answeredAt: 1,
  ...overrides,
});

async function renderFeedback(answer: AnswerRecord) {
  return render(AnswerFeedback, {
    inputs: { record: answer, correctAnswer: 'Paris' },
    providers: provideQuizTesting(),
  });
}

describe('AnswerFeedback', () => {
  it('confirms a correct answer without repeating it', async () => {
    const { fixture } = await renderFeedback(record());

    const status = await screen.findByRole('status');
    expect(status.textContent).toContain('Correct');
    expect(screen.queryByTestId('quiz-correct-answer')).toBeNull();
    expect(fixture.nativeElement.classList.contains('correct')).toBe(true);
  });

  it('shows the correct answer in its own block after a mistake', async () => {
    const { fixture } = await renderFeedback(
      record({
        correct: false,
        judgement: 'incorrect',
        answer: { kind: 'choice', countryCode: 'de' },
      }),
    );

    expect((await screen.findByRole('status')).textContent).toContain(
      'Not quite',
    );
    expect(screen.getByText('Correct answer')).toBeTruthy();
    expect(screen.getByTestId('quiz-correct-answer').textContent?.trim()).toBe(
      'Paris',
    );
    expect(fixture.nativeElement.classList.contains('correct')).toBe(false);
  });

  it('says which answer a typo was accepted as', async () => {
    await renderFeedback(
      record({
        answer: { kind: 'text', text: 'Pariss' },
        judgement: 'typo',
        matchedText: 'Paris',
      }),
    );

    expect((await screen.findByRole('status')).textContent).toContain(
      'Accepted as Paris',
    );
  });
});
