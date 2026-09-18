import { fireEvent, render, screen } from '@testing-library/angular';
import type { QuizConfig, QuizSession } from '@world-quiz/quiz/domain';
import { FIXTURE_DATASET } from '@world-quiz/quiz/domain/testing';
import { provideQuizTesting } from '../../testing/quiz-testing';
import { QuizPlay } from './quiz-play';

const config = (overrides: Partial<QuizConfig> = {}): QuizConfig => ({
  category: 'capitals',
  difficulty: 'easy',
  mode: 'fixed',
  scope: 'world',
  questionCount: 2,
  ...overrides,
});

async function renderPlay(overrides: Partial<QuizConfig> = {}) {
  const finished: QuizSession[] = [];
  const view = await render(QuizPlay, {
    inputs: { config: config(overrides), seed: 'spec-seed' },
    on: { finished: (session: QuizSession) => finished.push(session) },
    providers: provideQuizTesting(),
  });
  return { ...view, finished };
}

/** The country the current question asks about, read from the prompt. */
function askedCountry() {
  const name = screen.getByTestId('quiz-country').textContent?.trim() ?? '';
  const country = FIXTURE_DATASET.find((entry) => entry.name.en === name);
  if (!country) throw new Error(`Unknown country in prompt: "${name}"`);
  return country;
}

/** The offered answers, in the order they are shown. */
function choiceCodes(): string[] {
  return [...screen.getByTestId('quiz-choices').querySelectorAll('button')].map(
    (button) => button.dataset['testid']?.replace('quiz-choice-', '') ?? '',
  );
}

/** ion-input does not upgrade in jsdom; this is the event its accessor listens to. */
function typeAnswer(value: string): void {
  const input = screen.getByTestId('quiz-answer-input') as HTMLElement & {
    value?: string;
  };
  input.value = value;
  fireEvent(input, new CustomEvent('ionInput', { detail: { value } }));
}

describe('QuizPlay', () => {
  it('asks for the capital of a country and counts the question', async () => {
    await renderPlay();

    expect((await screen.findByTestId('quiz-position')).textContent).toContain(
      'Question 1 of 2',
    );
    // The question is asked once, above the card; the card names the country.
    expect(screen.getByTestId('quiz-question').textContent?.trim()).toBe(
      'What is the capital?',
    );
    expect(screen.getByTestId('quiz-country').textContent?.trim()).toBe(
      askedCountry().name.en,
    );
    expect(choiceCodes()).toHaveLength(4);
  });

  it('confirms a correct choice and moves on after Continue', async () => {
    await renderPlay();
    const country = askedCountry();

    fireEvent.click(await screen.findByTestId(`quiz-choice-${country.code}`));

    expect(screen.getByTestId('quiz-feedback').textContent).toContain(
      'Correct',
    );
    expect(screen.getByTestId('quiz-score').textContent).toContain('1');

    fireEvent.click(screen.getByTestId('quiz-continue'));

    expect(screen.getByTestId('quiz-position').textContent).toContain(
      'Question 2 of 2',
    );
  });

  it('shows the correct answer after a wrong choice', async () => {
    await renderPlay();
    const country = askedCountry();
    const wrong = choiceCodes().find((code) => code !== country.code);

    fireEvent.click(await screen.findByTestId(`quiz-choice-${wrong}`));

    expect(screen.getByTestId('quiz-feedback').textContent).toContain(
      'Not quite',
    );
    expect(screen.getByTestId('quiz-correct-answer').textContent).toContain(
      country.capital.en,
    );
  });

  it('emits the finished session once the last feedback is acknowledged', async () => {
    const { finished } = await renderPlay({ questionCount: 1 });
    const country = askedCountry();

    fireEvent.click(await screen.findByTestId(`quiz-choice-${country.code}`));
    expect(finished).toHaveLength(0);

    fireEvent.click(screen.getByTestId('quiz-continue'));

    expect(finished).toHaveLength(1);
    expect(finished[0]?.status).toBe('finished');
  });

  it('rejects an empty answer in hard mode and accepts the capital', async () => {
    const { fixture } = await renderPlay({
      difficulty: 'hard',
      questionCount: 1,
    });
    const country = askedCountry();

    fireEvent.click(await screen.findByTestId('quiz-submit'));
    expect(screen.getByRole('alert').textContent).toContain(
      'Type an answer first',
    );

    typeAnswer(country.capital.en);
    fixture.detectChanges();
    fireEvent.click(screen.getByTestId('quiz-submit'));

    expect(screen.getByTestId('quiz-feedback').textContent).toContain(
      'Correct',
    );
  });
});
