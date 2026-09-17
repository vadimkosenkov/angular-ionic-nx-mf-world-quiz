import type { Difficulty } from './vocabulary';

/**
 * Mastery of one country in one category, as a small deterministic state
 * machine (docs/domain/mastery.md):
 *
 *   correct Easy  → points + 1
 *   correct Hard  → points + 2
 *   incorrect     → points = 0, everWrong = true
 *   mastered      ⇔ points ≥ 3
 *   mistake       ⇔ everWrong ∧ ¬mastered
 */
export const MASTERY_THRESHOLD = 3;

export const MASTERY_POINTS: Readonly<Record<Difficulty, number>> = {
  easy: 1,
  hard: 2,
};

export interface MasteryState {
  readonly points: number;
  readonly everWrong: boolean;
  readonly correctCount: number;
  readonly incorrectCount: number;
  readonly lastAnsweredAt: number | null;
}

export const INITIAL_MASTERY: MasteryState = {
  points: 0,
  everWrong: false,
  correctCount: 0,
  incorrectCount: 0,
  lastAnsweredAt: null,
};

export interface MasteryAnswer {
  readonly difficulty: Difficulty;
  readonly correct: boolean;
  readonly answeredAt: number;
}

export function applyMasteryAnswer(
  state: MasteryState,
  answer: MasteryAnswer,
): MasteryState {
  return answer.correct
    ? {
        ...state,
        points: state.points + MASTERY_POINTS[answer.difficulty],
        correctCount: state.correctCount + 1,
        lastAnsweredAt: answer.answeredAt,
      }
    : {
        ...state,
        points: 0,
        everWrong: true,
        incorrectCount: state.incorrectCount + 1,
        lastAnsweredAt: answer.answeredAt,
      };
}

export function isMastered(state: MasteryState): boolean {
  return state.points >= MASTERY_THRESHOLD;
}

/** A practice candidate: answered wrong at some point and not (re-)mastered since. */
export function isMistake(state: MasteryState): boolean {
  return state.everWrong && !isMastered(state);
}
