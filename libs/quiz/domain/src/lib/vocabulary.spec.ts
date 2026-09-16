import {
  DIFFICULTIES,
  isDifficulty,
  isLeaderboardBoardId,
  isQuizCategory,
  isQuizScope,
  isRegion,
  isTrainingMode,
  LEADERBOARD_BOARDS,
  QUIZ_CATEGORIES,
  QUIZ_SCOPES,
  REGIONS,
  TRAINING_MODES,
} from './vocabulary';

describe('quiz vocabulary', () => {
  it('has exactly two categories and two difficulties', () => {
    expect(QUIZ_CATEGORIES).toEqual(['capitals', 'flags']);
    expect(DIFFICULTIES).toEqual(['easy', 'hard']);
  });

  it('has exactly three training modes', () => {
    expect(TRAINING_MODES).toEqual(['fixed', 'endless', 'timed']);
  });

  it('classifies countries into six regions and lets quizzes use World or one region', () => {
    expect(REGIONS).toHaveLength(6);
    expect(REGIONS).not.toContain('world');
    expect(QUIZ_SCOPES).toEqual(['world', ...REGIONS]);
  });

  it('uses unique identifiers everywhere', () => {
    for (const list of [
      QUIZ_CATEGORIES,
      DIFFICULTIES,
      TRAINING_MODES,
      QUIZ_SCOPES,
    ]) {
      expect(new Set(list).size).toBe(list.length);
    }
  });
});

describe('LEADERBOARD_BOARDS', () => {
  it('defines exactly four global boards: category × difficulty', () => {
    expect(LEADERBOARD_BOARDS.map((board) => board.id)).toEqual([
      'capitals-easy',
      'capitals-hard',
      'flags-easy',
      'flags-hard',
    ]);
  });

  it('always uses the complete World scope (no regional boards)', () => {
    expect(LEADERBOARD_BOARDS.every((board) => board.scope === 'world')).toBe(
      true,
    );
  });

  it('does not create boards for training modes', () => {
    const ids: readonly string[] = LEADERBOARD_BOARDS.map((board) => board.id);
    for (const mode of TRAINING_MODES) {
      expect(ids.some((id) => id.includes(mode))).toBe(false);
    }
  });
});

describe('type guards', () => {
  it.each([
    [isQuizCategory, 'capitals', 'reverse-capitals'],
    [isDifficulty, 'hard', 'expert'],
    [isTrainingMode, 'timed', 'streak'],
    [isRegion, 'oceania', 'world'],
    [isQuizScope, 'world', 'antarctica'],
    [isLeaderboardBoardId, 'flags-hard', 'flags-timed'],
  ] as const)('%o accepts %s and rejects %s', (guard, valid, invalid) => {
    expect(guard(valid)).toBe(true);
    expect(guard(invalid)).toBe(false);
  });

  it.each([undefined, null, 42, {}, ['capitals'], 'Capitals', ' capitals'])(
    'rejects untrusted non-matching input %o',
    (value) => {
      expect(isQuizCategory(value)).toBe(false);
    },
  );
});
