import type { MasteryAnswer, MasteryState } from './mastery';
import {
  applyMasteryAnswer,
  INITIAL_MASTERY,
  isMastered,
  isMistake,
} from './mastery';

type Step = 'easy✓' | 'hard✓' | 'easy✗' | 'hard✗';

function replay(steps: readonly Step[]): MasteryState {
  return steps.reduce<MasteryState>((state, step, index) => {
    const answer: MasteryAnswer = {
      difficulty: step.startsWith('easy') ? 'easy' : 'hard',
      correct: step.endsWith('✓'),
      answeredAt: index + 1,
    };
    return applyMasteryAnswer(state, answer);
  }, INITIAL_MASTERY);
}

describe('mastery state machine', () => {
  it('starts unmastered and not a mistake', () => {
    expect(isMastered(INITIAL_MASTERY)).toBe(false);
    expect(isMistake(INITIAL_MASTERY)).toBe(false);
  });

  // The examples table from docs/domain/mastery.md, plus edge cases.
  it.each<[Step[], number, boolean, boolean]>([
    [['easy✓', 'easy✓', 'easy✓'], 3, true, false],
    [['hard✓', 'easy✓'], 3, true, false],
    [['easy✓', 'easy✓', 'easy✗'], 0, false, true],
    [['easy✗', 'hard✓', 'hard✓'], 4, true, false],
    [['easy✓', 'easy✓'], 2, false, false],
    [['hard✓'], 2, false, false],
    [['hard✗'], 0, false, true],
    [['easy✗', 'hard✓'], 2, false, true],
    [['hard✓', 'hard✓', 'easy✗', 'easy✓'], 1, false, true],
  ])(
    '%j → points %i, mastered %s, mistake %s',
    (steps, points, mastered, mistake) => {
      const state = replay(steps);
      expect(state.points).toBe(points);
      expect(isMastered(state)).toBe(mastered);
      expect(isMistake(state)).toBe(mistake);
    },
  );

  it('counts answers and remembers the last answer time', () => {
    expect(replay(['easy✓', 'hard✗', 'hard✓'])).toEqual({
      points: 2,
      everWrong: true,
      correctCount: 2,
      incorrectCount: 1,
      lastAnsweredAt: 3,
    });
  });

  it('never mutates the previous state', () => {
    const before = replay(['easy✓']);
    const snapshot = { ...before };
    applyMasteryAnswer(before, {
      difficulty: 'hard',
      correct: false,
      answeredAt: 9,
    });
    expect(before).toEqual(snapshot);
  });
});
