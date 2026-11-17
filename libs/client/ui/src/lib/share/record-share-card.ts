import type { ShareCard, TranslateFn } from '@world-quiz/client/ui';
import type { LeaderboardBoardId } from '@world-quiz/quiz/domain';

/** What the picture of a personal record is made of. */
export interface RecordShareFacts {
  readonly board: LeaderboardBoardId;
  /** The run's time as the screen shows it ("4:07.3"). */
  readonly time: string;
  readonly rank: number;
  readonly players: number;
}

/**
 * The words of the picture a record is shared as, built outside the page so
 * they are tested without rendering it.
 *
 * A board ranks on time, so the time is the headline; the place and the
 * size of the board are the figures under it. Only ranked runs have a
 * record at all, which is why the line between them can say so plainly.
 */
export function recordShareCard(
  record: RecordShareFacts,
  translate: TranslateFn,
): ShareCard {
  return {
    title: translate('share.title'),
    subject: translate(`leaderboard.boards.${record.board}`),
    headline: record.time,
    note: translate('share.record.perfect'),
    stats: [
      { label: translate('share.record.place'), value: `#${record.rank}` },
      {
        label: translate('share.record.players'),
        value: `${record.players}`,
      },
    ],
  };
}
