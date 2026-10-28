import { fireEvent, render, screen } from '@testing-library/angular';
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
  it('repeats the answer the player chose when it was right', async () => {
    const { fixture } = await renderFeedback(record());

    const status = await screen.findByRole('status');
    expect(status.textContent).toContain('Correct');
    expect(screen.getByText('Your answer')).toBeTruthy();
    expect(screen.getByTestId('quiz-correct-answer').textContent?.trim()).toBe(
      'Paris',
    );
    expect(fixture.nativeElement.classList.contains('correct')).toBe(true);
  });

  // The card replaces the button that used to live at the bottom of the
  // screen, so the whole of it has to move the quiz on.
  it('moves on when the card is pressed', async () => {
    let moved = 0;
    await render(AnswerFeedback, {
      inputs: { record: record(), correctAnswer: 'Paris' },
      on: { next: () => (moved += 1) },
      providers: provideQuizTesting(),
    });

    fireEvent.click(screen.getByTestId('quiz-continue'));

    expect(moved).toBe(1);
  });

  // Without the hint nothing says the card is a control at all.
  it('says that pressing it continues', async () => {
    await renderFeedback(record());

    expect(screen.getByTestId('quiz-continue').textContent).toContain(
      'Tap to continue',
    );
  });

  // So a keyboard continues with Enter, and a screen reader lands on the
  // verdict rather than on whatever the answers left behind.
  it('takes focus when it appears', async () => {
    await renderFeedback(record());

    expect(document.activeElement).toBe(screen.getByTestId('quiz-continue'));
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

  // The block holds the spelling to remember, not what was typed, so it may
  // not claim to be the player's own answer here.
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
    expect(screen.getByText('Correct answer')).toBeTruthy();
    expect(screen.queryByText('Your answer')).toBeNull();
    expect(screen.getByTestId('quiz-correct-answer').textContent?.trim()).toBe(
      'Paris',
    );
  });
});
