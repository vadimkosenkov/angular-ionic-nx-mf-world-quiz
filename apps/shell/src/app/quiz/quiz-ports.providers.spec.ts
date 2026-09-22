import { TestBed } from '@angular/core/testing';
import {
  QUIZ_PROGRESS_READER,
  QUIZ_RESULT_SINK,
} from '@world-quiz/client/quiz-ports';
import {
  countriesInScope,
  type Difficulty,
  type QuizSession,
  summarizeSession,
} from '@world-quiz/quiz/domain';
import { FIXTURE_DATASET } from '@world-quiz/quiz/domain/testing';
import { COUNTRY_DATASET } from '../core/tokens';
import {
  createMemoryLocalStore,
  LOCAL_STORE,
  ProgressStore,
  SyncService,
} from '@world-quiz/client/progress';
import { provideQuizPorts } from './quiz-ports.providers';

/** A finished Capitals session with one answer per entry. */
function session(
  answers: readonly { code: string; correct: boolean }[],
  difficulty: Difficulty = 'hard',
): QuizSession {
  return {
    config: {
      category: 'capitals',
      difficulty,
      mode: 'fixed',
      scope: 'world',
      questionCount: answers.length,
    },
    seed: 'spec-seed',
    startedAt: 1_000,
    answers: answers.map((answer, index) => ({
      questionIndex: index,
      countryCode: answer.code,
      answer: { kind: 'choice' as const, countryCode: answer.code },
      correct: answer.correct,
      judgement: answer.correct ? ('choice' as const) : ('incorrect' as const),
      answeredAt: 1_000 + index,
    })),
    status: 'finished',
    finishedAt: 1_000 + answers.length,
    endReason: 'completed',
  };
}

function setup() {
  const syncs = { count: 0 };
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: COUNTRY_DATASET, useValue: FIXTURE_DATASET },
      { provide: LOCAL_STORE, useValue: createMemoryLocalStore() },
      {
        provide: SyncService,
        useValue: { sync: () => (syncs.count++, Promise.resolve()) },
      },
      provideQuizPorts(),
    ],
  });
  return {
    syncs,
    sink: TestBed.inject(QUIZ_RESULT_SINK),
    reader: TestBed.inject(QUIZ_PROGRESS_READER),
    progress: TestBed.inject(ProgressStore),
  };
}

/** Two correct Hard answers are 4 points, above the mastery threshold. */
function master(codes: readonly string[]) {
  return [...codes, ...codes].map((code) => ({ code, correct: true }));
}

describe('shell quiz ports', () => {
  it('records a finished session on the device, in the outbox, and asks for a sync', () => {
    const { sink, progress, syncs } = setup();
    const finished = session([
      { code: 'fr', correct: true },
      { code: 'fr', correct: true },
      { code: 'de', correct: false },
    ]);

    sink.submit(finished, summarizeSession(finished, finished.answers.length));

    expect(progress.scope('capitals', 'world').mastered).toBe(1);
    expect(progress.mistakeCount()).toBe(1);
    expect(progress.pendingCount()).toBe(1);
    expect(syncs.count).toBe(1);
  });

  it('reports the countries that still need practice', () => {
    const { sink } = setup();
    const finished = session([{ code: 'de', correct: false }]);

    const outcome = sink.submit(
      finished,
      summarizeSession(finished, finished.answers.length),
    );

    expect(outcome.mistakes).toEqual(['de']);
    expect(outcome.newlyUnlocked).toEqual([]);
  });

  it('reports achievements unlocked by this session only', () => {
    const { sink } = setup();
    const europe = countriesInScope(FIXTURE_DATASET, 'europe').map(
      (country) => country.code,
    );
    const finished = session(master(europe));

    const outcome = sink.submit(
      finished,
      summarizeSession(finished, finished.answers.length),
    );

    expect(outcome.newlyUnlocked.map((entry) => entry.id)).toEqual([
      'capitals-europe-mastered',
    ]);

    // Playing the same countries again unlocks nothing new.
    const again = sink.submit(
      finished,
      summarizeSession(finished, finished.answers.length),
    );
    expect(again.newlyUnlocked).toEqual([]);
  });

  it('reads progress per scope without going through the store', () => {
    const { sink, reader } = setup();
    const finished = session(master(['fr']));
    sink.submit(finished, summarizeSession(finished, finished.answers.length));

    expect(reader.scopeProgress('capitals', 'europe').mastered).toBe(1);
    expect(reader.scopeProgress('flags', 'europe').mastered).toBe(0);
    expect(reader.mistakes('capitals')).toEqual([]);
  });
});
