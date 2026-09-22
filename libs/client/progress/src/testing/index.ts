/**
 * Test helpers for progress and sync. Test-only entry point
 * (`@world-quiz/client/progress/testing`): never import it from production code.
 */

import type {
  SessionHistoryEntry,
  SessionResult,
  User,
} from '@world-quiz/shared/contracts';
import type {
  Difficulty,
  QuizCategory,
  QuizSession,
} from '@world-quiz/quiz/domain';

export const API = 'http://api.test';

export const ANN: User = {
  id: '1f0e6b8f-0000-4000-8000-000000000001',
  displayName: 'Ann',
  nickname: 'Ann the Explorer',
  email: 'ann@example.com',
  providers: ['google'],
  createdAt: '2026-09-21T10:00:00.000Z',
};

export const BOB: User = {
  ...ANN,
  id: '1f0e6b8f-0000-4000-8000-000000000002',
  displayName: 'Bob',
  email: 'bob@example.com',
};

/** A finished session with one Easy answer per entry, answered 1 s apart. */
export function finishedSession(
  answers: readonly { readonly code: string; readonly correct: boolean }[],
  {
    category = 'capitals',
    difficulty = 'easy',
    startedAt = 1_000_000,
  }: {
    readonly category?: QuizCategory;
    readonly difficulty?: Difficulty;
    readonly startedAt?: number;
  } = {},
): QuizSession {
  return {
    config: {
      category,
      difficulty,
      mode: 'fixed',
      scope: 'world',
      questionCount: answers.length,
    },
    seed: `seed-${startedAt}`,
    startedAt,
    answers: answers.map((answer, index) => ({
      questionIndex: index,
      countryCode: answer.code,
      answer: { kind: 'choice' as const, countryCode: answer.code },
      correct: answer.correct,
      judgement: answer.correct ? ('choice' as const) : ('incorrect' as const),
      answeredAt: startedAt + (index + 1) * 1_000,
    })),
    status: 'finished',
    finishedAt: startedAt + answers.length * 1_000,
    endReason: 'completed',
  };
}

/** A history entry as `GET /v1/sessions` returns it. */
export function historyEntry(
  id: string,
  answers: readonly { readonly code: string; readonly correct: boolean }[],
  { startedAt = 2_000_000, category = 'capitals' as QuizCategory } = {},
): SessionHistoryEntry {
  const correct = answers.filter((answer) => answer.correct).length;
  return {
    id,
    config: {
      category,
      difficulty: 'easy',
      mode: 'fixed',
      scope: 'world',
      questionCount: answers.length,
    },
    summary: {
      answered: answers.length,
      correct,
      incorrect: answers.length - correct,
      accuracy: answers.length === 0 ? 0 : correct / answers.length,
      durationMs: answers.length * 1_000,
      endReason: 'completed',
      completed: true,
      perfect: correct === answers.length,
    },
    recordedAt: '2026-09-22T10:00:00.000Z',
    startedAt,
    finishedAt: startedAt + answers.length * 1_000,
    answers: answers.map((answer, index) => ({
      countryCode: answer.code,
      correct: answer.correct,
      answeredAt: startedAt + (index + 1) * 1_000,
    })),
  };
}

/** What `POST /v1/sessions` answers, for a session with this id. */
export function sessionResult(
  id: string,
  extra: Partial<SessionResult> = {},
): SessionResult {
  return {
    id,
    config: {
      category: 'capitals',
      difficulty: 'easy',
      mode: 'fixed',
      scope: 'world',
      questionCount: 1,
    },
    summary: {
      answered: 1,
      correct: 1,
      incorrect: 0,
      accuracy: 1,
      durationMs: 1_000,
      endReason: 'completed',
      completed: true,
      perfect: true,
    },
    recordedAt: '2026-09-22T10:00:00.000Z',
    ...extra,
  };
}
