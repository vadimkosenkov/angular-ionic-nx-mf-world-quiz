import {
  DIFFICULTIES,
  isDifficulty,
  isLeaderboardBoardId,
  isQuizCategory,
  isQuizScope,
  isQuizMode,
  isRankedMode,
  isRegion,
  LEADERBOARD_BOARDS,
  QUIZ_CATEGORIES,
  QUIZ_MODES,
  QUIZ_SCOPES,
  RANKED_MODES,
  REGIONS,
} from './vocabulary';

describe('quiz vocabulary', () => {
  it('has exactly two categories and two difficulties', () => {
    expect(QUIZ_CATEGORIES).toEqual(['capitals', 'flags']);
    expect(DIFFICULTIES).toEqual(['easy', 'hard']);
  });

  it('has three modes, two of which are ranked', () => {
    expect(QUIZ_MODES).toEqual(['fixed', 'endless', 'timed']);
    // Endless has no end to compare one player's run with another's.
    expect(RANKED_MODES).toEqual(['fixed', 'timed']);
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
      QUIZ_MODES,
      QUIZ_SCOPES,
    ]) {
      expect(new Set(list).size).toBe(list.length);
    }
  });
});

describe('LEADERBOARD_BOARDS', () => {
  it('is every combination of the four choices a setup asks for', () => {
    expect(LEADERBOARD_BOARDS).toHaveLength(
      QUIZ_CATEGORIES.length *
        DIFFICULTIES.length *
        QUIZ_SCOPES.length *
        RANKED_MODES.length,
    );
    expect(new Set(LEADERBOARD_BOARDS.map((board) => board.id)).size).toBe(
      LEADERBOARD_BOARDS.length,
    );
  });

  it('names a board after those choices, in one order', () => {
    expect(LEADERBOARD_BOARDS[0]).toEqual({
      id: 'capitals-easy-world-fixed',
      category: 'capitals',
      difficulty: 'easy',
      scope: 'world',
      mode: 'fixed',
      metric: 'time',
    });
  });

  it('ranks a quick round by time and a timed round by answers', () => {
    for (const board of LEADERBOARD_BOARDS) {
      expect(board.metric).toBe(board.mode === 'fixed' ? 'time' : 'correct');
    }
  });

  it('has no board for Endless, which has no end to compare', () => {
    const ids: readonly string[] = LEADERBOARD_BOARDS.map((board) => board.id);
    expect(ids.some((id) => id.includes('endless'))).toBe(false);
  });
});

describe('type guards', () => {
  it.each([
    [isQuizCategory, 'capitals', 'reverse-capitals'],
    [isDifficulty, 'hard', 'expert'],
    [isQuizMode, 'timed', 'streak'],
    [isRankedMode, 'fixed', 'endless'],
    [isRegion, 'oceania', 'world'],
    [isQuizScope, 'world', 'antarctica'],
    [isLeaderboardBoardId, 'flags-hard-oceania-timed', 'flags-hard'],
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
