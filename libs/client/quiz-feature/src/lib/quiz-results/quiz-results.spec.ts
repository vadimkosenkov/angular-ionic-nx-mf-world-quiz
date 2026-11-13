import { fireEvent, render, screen } from '@testing-library/angular';
import type { Provider } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  APP_URL,
  type QuizSessionOutcome,
} from '@world-quiz/client/quiz-ports';
import {
  SHARE_TARGET,
  type SharePayload,
  type ShareOutcome,
  Toasts,
} from '@world-quiz/client/ui';
import type { QuizConfig, SessionSummary } from '@world-quiz/quiz/domain';
import { provideQuizTesting } from '../../testing/quiz-testing';
import { QuizResults } from './quiz-results';

const config: QuizConfig = {
  category: 'capitals',
  difficulty: 'easy',
  mode: 'fixed',
  scope: 'world',
  questionCount: 10,
};

const summary = (overrides: Partial<SessionSummary> = {}): SessionSummary => ({
  totalQuestions: 10,
  answered: 10,
  correct: 8,
  incorrect: 2,
  accuracy: 0.8,
  durationMs: 95_000,
  endReason: 'completed',
  completed: true,
  perfect: false,
  mistakes: ['fr', 'de'],
  ...overrides,
});

async function renderResults(
  overrides: Partial<SessionSummary> = {},
  outcome: QuizSessionOutcome | null = null,
) {
  return render(QuizResults, {
    inputs: { config, summary: summary(overrides), outcome },
    providers: provideQuizTesting(),
  });
}

describe('QuizResults', () => {
  it('shows score, accuracy and time', async () => {
    await renderResults();

    expect((await screen.findByTestId('results-score')).textContent).toContain(
      '8 of 10 correct',
    );
    expect(screen.getByTestId('results-accuracy').textContent).toContain('80%');
    expect(screen.getByTestId('results-time').textContent).toContain('1:35');
  });

  it('lists the countries to review with their correct answer', async () => {
    await renderResults();
    const review = await screen.findByTestId('results-review');

    expect(review.textContent).toContain('France');
    expect(review.textContent).toContain('Paris');
    expect(review.textContent).toContain('Germany');
  });

  it('celebrates a perfect run and hides the review list', async () => {
    await renderResults({
      correct: 10,
      incorrect: 0,
      accuracy: 1,
      perfect: true,
      mistakes: [],
    });

    expect((await screen.findByTestId('results-hero')).textContent).toContain(
      'Perfect run!',
    );
    expect(screen.queryByTestId('results-review')).toBeNull();
  });

  it('announces newly unlocked achievements only when there are any', async () => {
    const { rerender } = await renderResults();
    expect(screen.queryByTestId('results-unlocked')).toBeNull();

    await rerender({
      inputs: {
        config,
        summary: summary(),
        outcome: {
          newlyUnlocked: [
            {
              id: 'capitals-europe-mastered',
              category: 'capitals',
              scope: 'europe',
            },
          ],
          mistakes: [],
        } satisfies QuizSessionOutcome,
      },
    });

    expect(screen.getByTestId('results-unlocked').textContent).toContain(
      'Europe · Capitals',
    );
  });

  it('emits play again and exit', async () => {
    const events: string[] = [];
    await render(QuizResults, {
      inputs: { config, summary: summary(), outcome: null },
      on: {
        playAgain: () => events.push('play-again'),
        exited: () => events.push('exit'),
      },
      providers: provideQuizTesting(),
    });

    fireEvent.click(await screen.findByTestId('results-play-again'));
    fireEvent.click(screen.getByTestId('results-exit'));

    expect(events).toEqual(['play-again', 'exit']);
  });

  describe('sharing the run', () => {
    /** Records what was handed over and answers with the given outcome. */
    function shareTarget(outcome: ShareOutcome) {
      const shared: SharePayload[] = [];
      return {
        shared,
        provider: {
          provide: SHARE_TARGET,
          useValue: {
            share: (payload: SharePayload) => {
              shared.push(payload);
              return Promise.resolve(outcome);
            },
          },
        },
      };
    }

    const renderWith = (target: { provider: Provider }, appUrl = '') =>
      render(QuizResults, {
        inputs: { config, summary: summary(), outcome: null },
        providers: [
          provideQuizTesting(),
          { provide: APP_URL, useValue: appUrl },
          target.provider,
        ],
      });

    it('hands over the run as text and a link to the app', async () => {
      const target = shareTarget('shared');
      await renderWith(target, 'https://play.example.test');

      fireEvent.click(await screen.findByTestId('results-share'));
      await Promise.resolve();

      expect(target.shared).toHaveLength(1);
      expect(target.shared[0]).toMatchObject({
        title: 'World Quiz',
        text: 'World Quiz — Capitals, World, Easy\n8/10 correct · 80% · 1:35',
        url: 'https://play.example.test',
      });
      // The picture goes with it, for the devices that take one; what it
      // says is `runShareCard`'s own test, and jsdom has no canvas to draw
      // it on.
      expect(target.shared[0]?.image).toBeTypeOf('function');
      // The sheet opening is its own confirmation.
      expect(TestBed.inject(Toasts).current()).toBeNull();
    });

    // The iPhone app has no address of its own to send anyone to.
    it('shares the text alone when the app has no address', async () => {
      const target = shareTarget('shared');
      await renderWith(target);

      fireEvent.click(await screen.findByTestId('results-share'));
      await Promise.resolve();

      expect(target.shared[0]).not.toHaveProperty('url');
    });

    it('says so when the message was copied instead', async () => {
      const target = shareTarget('copied');
      await renderWith(target);

      fireEvent.click(await screen.findByTestId('results-share'));
      await Promise.resolve();

      expect(TestBed.inject(Toasts).current()).toMatchObject({
        tone: 'success',
      });
    });

    it('reports a share this browser could not do', async () => {
      const target = shareTarget('failed');
      await renderWith(target);

      fireEvent.click(await screen.findByTestId('results-share'));
      await Promise.resolve();

      expect(TestBed.inject(Toasts).current()).toMatchObject({
        tone: 'error',
      });
    });

    // Closing the sheet is an answer, not a failure.
    it('says nothing when the player closes the sheet', async () => {
      const target = shareTarget('cancelled');
      await renderWith(target);

      fireEvent.click(await screen.findByTestId('results-share'));
      await Promise.resolve();

      expect(TestBed.inject(Toasts).current()).toBeNull();
    });
  });
});
