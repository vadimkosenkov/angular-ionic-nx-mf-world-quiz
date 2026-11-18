import { LEADERBOARD_BOARDS } from '@world-quiz/quiz/domain';
import {
  DEFAULT_LEADERBOARD_SIZE,
  LEADERBOARD_BOARD_IDS,
  leaderboardBoardIdSchema,
  leaderboardQuerySchema,
  nicknameSchema,
  updateProfileRequestSchema,
} from './leaderboard';

describe('leaderboard contracts', () => {
  it('lists exactly the domain boards', () => {
    expect([...LEADERBOARD_BOARD_IDS].sort()).toEqual(
      LEADERBOARD_BOARDS.map((board) => board.id).sort(),
    );
  });

  it('accepts a board id and nothing that merely looks like one', () => {
    expect(
      leaderboardBoardIdSchema.safeParse('flags-hard-europe-fixed').success,
    ).toBe(true);
    // The old four boards, a training mode, and a region that is not one.
    for (const id of [
      'flags-hard',
      'flags-hard-europe-endless',
      'flags-hard-balkans-fixed',
    ]) {
      expect(leaderboardBoardIdSchema.safeParse(id).success).toBe(false);
    }
  });

  it('reads the board size from the query string, bounded', () => {
    expect(leaderboardQuerySchema.parse({})).toEqual({
      limit: DEFAULT_LEADERBOARD_SIZE,
    });
    expect(leaderboardQuerySchema.parse({ limit: '10' })).toEqual({
      limit: 10,
    });
    expect(leaderboardQuerySchema.safeParse({ limit: '101' }).success).toBe(
      false,
    );
  });
});

describe('nicknameSchema', () => {
  it.each([
    ['Ann'],
    ['Globe_Trotter-7'],
    ['Мария Иванова'],
    ['J.R.R'],
    ['東京タワー'],
  ])('accepts %j', (nickname) => {
    expect(nicknameSchema.safeParse(nickname).success).toBe(true);
  });

  it('trims surrounding spaces', () => {
    expect(nicknameSchema.parse('  Ann  ')).toBe('Ann');
  });

  it.each([
    ['ab'],
    ['x'.repeat(25)],
    ['_ann'],
    ['ann-'],
    ['two  spaces'],
    ['<script>'],
    ['emoji 🙂'],
    ['line\nbreak'],
  ])('rejects %j', (nickname) => {
    expect(nicknameSchema.safeParse(nickname).success).toBe(false);
  });

  it('is the only field a player may change', () => {
    expect(
      updateProfileRequestSchema.safeParse({ nickname: 'Ann', email: 'x' })
        .success,
    ).toBe(false);
  });
});
