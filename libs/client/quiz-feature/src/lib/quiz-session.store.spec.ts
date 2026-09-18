import { TestBed } from '@angular/core/testing';
import { CLOCK, COUNTRY_DATASET } from '@world-quiz/client/quiz-ports';
import {
  displayAnswer,
  indexCountriesByCode,
  type QuizConfig,
  TIMED_MODE_DURATION_MS,
} from '@world-quiz/quiz/domain';
import { FIXTURE_DATASET } from '@world-quiz/quiz/domain/testing';
import { createManualClock, type ManualClock } from '@world-quiz/shared/util';
import { QuizSessionStore } from './quiz-session.store';

const countries = indexCountriesByCode(FIXTURE_DATASET);

const config = (overrides: Partial<QuizConfig> = {}): QuizConfig => ({
  category: 'capitals',
  difficulty: 'easy',
  mode: 'fixed',
  scope: 'world',
  questionCount: 3,
  ...overrides,
});

function setup(): { store: QuizSessionStore; clock: ManualClock } {
  const clock = createManualClock(1_000);
  // Each store gets its own injector, so a test can compare two sessions.
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      QuizSessionStore,
      { provide: COUNTRY_DATASET, useValue: FIXTURE_DATASET },
      { provide: CLOCK, useValue: clock },
    ],
  });
  return { store: TestBed.inject(QuizSessionStore), clock };
}

/** Answers the current question correctly, whatever it asks. */
function answerCorrectly(store: QuizSessionStore): void {
  const question = store.question();
  if (!question) throw new Error('No current question');
  const country = countries.get(question.countryCode);
  if (!country) throw new Error('Unknown country in question');

  if (store.config()?.difficulty === 'easy') {
    store.answerChoice(question.countryCode);
  } else {
    store.answerText(displayAnswer(country, 'capitals', 'en'));
  }
}

describe('QuizSessionStore', () => {
  it('starts a session and exposes the first question', () => {
    const { store } = setup();
    store.start(config(), 'seed');

    expect(store.status()).toBe('active');
    expect(store.total()).toBe(3);
    expect(store.position()).toBe(1);
    expect(store.question()?.choices).toHaveLength(4);
    expect(store.country()?.code).toBe(store.question()?.countryCode);
  });

  it('is deterministic for the same seed', () => {
    const first = setup().store;
    first.start(config(), 'same-seed');
    const second = setup().store;
    second.start(config(), 'same-seed');

    expect(first.question()?.countryCode).toBe(second.question()?.countryCode);
  });

  it('shows feedback instead of the next question until continue', () => {
    const { store } = setup();
    store.start(config(), 'seed');
    answerCorrectly(store);

    expect(store.feedback()?.record.correct).toBe(true);
    expect(store.question()).toBeNull();
    expect(store.correctCount()).toBe(1);

    store.continue();
    expect(store.feedback()).toBeNull();
    expect(store.position()).toBe(2);
  });

  it('ignores answers while feedback is shown', () => {
    const { store } = setup();
    store.start(config(), 'seed');
    answerCorrectly(store);
    const answered = store.answeredCount();

    store.answerChoice(store.feedback()?.record.countryCode ?? '');

    expect(store.answeredCount()).toBe(answered);
  });

  it('reports a wrong answer and keeps the asked country visible', () => {
    const { store } = setup();
    store.start(config(), 'seed');
    const question = store.question();
    if (!question) throw new Error('No current question');
    const asked = question.countryCode;
    const wrong = (question.choices ?? []).find((code) => code !== asked);
    if (!wrong) throw new Error('Expected an alternative choice');

    store.answerChoice(wrong);

    expect(store.feedback()?.record.correct).toBe(false);
    expect(store.country()?.code).toBe(asked);
    expect(store.summary()?.mistakes).toEqual([asked]);
  });

  it('finishes after the planned number of questions', () => {
    const { store, clock } = setup();
    store.start(config(), 'seed');

    for (let index = 0; index < 3; index++) {
      clock.advance(1_000);
      answerCorrectly(store);
      store.continue();
    }

    expect(store.finishedSession()).not.toBeNull();
    expect(store.summary()?.completed).toBe(true);
    expect(store.summary()?.perfect).toBe(true);
    expect(store.summary()?.durationMs).toBe(3_000);
  });

  it('accepts typed answers in hard mode, including typos', () => {
    const { store } = setup();
    store.start(config({ difficulty: 'hard', questionCount: 1 }), 'seed');
    const country = countries.get(store.question()?.countryCode ?? '');
    const capital = country?.capital.en ?? '';

    store.answerText(`${capital.slice(0, -1)}${capital.slice(-1)}x`);

    expect(store.feedback()).not.toBeNull();
  });

  it('counts down and expires a timed session', () => {
    const { store, clock } = setup();
    store.start(config({ mode: 'timed', questionCount: undefined }), 'seed');

    expect(store.remainingMs()).toBe(TIMED_MODE_DURATION_MS);
    expect(store.total()).toBeNull();

    clock.advance(TIMED_MODE_DURATION_MS / 2);
    store.tick();
    expect(store.remainingMs()).toBe(TIMED_MODE_DURATION_MS / 2);
    expect(store.finishedSession()).toBeNull();

    clock.advance(TIMED_MODE_DURATION_MS / 2);
    store.tick();
    expect(store.remainingMs()).toBe(0);
    expect(store.finishedSession()?.endReason).toBe('time-up');
  });

  it('stops an endless session on request', () => {
    const { store } = setup();
    store.start(config({ mode: 'endless', questionCount: undefined }), 'seed');
    answerCorrectly(store);
    store.continue();

    store.stop();

    expect(store.finishedSession()?.endReason).toBe('stopped');
    expect(store.summary()?.answered).toBe(1);
  });
});
