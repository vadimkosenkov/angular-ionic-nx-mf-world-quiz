import type { ShareCard, TranslateFn } from './share-card';

/** What the picture of a personal record is made of. */
export interface RecordShareFacts {
  /** The board's four settings, already translated and joined. */
  readonly board: string;
  /**
   * What the board ranks the run by, as the screen shows it: a time
   * ("4:07.3") or a number of answers ("21 correct").
   */
  readonly score: string;
  readonly rank: number;
  readonly players: number;
}

/**
 * The words of the picture a record is shared as, built outside the page so
 * they are tested without rendering it.
 *
 * What the board ranks by is the headline; the place and the size of the
 * board are the figures under it. Only a flawless run has a record at all,
 * which is why the line between them can say so plainly.
 */
export function recordShareCard(
  record: RecordShareFacts,
  translate: TranslateFn,
): ShareCard {
  return {
    title: translate('share.title'),
    subject: record.board,
    headline: record.score,
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
