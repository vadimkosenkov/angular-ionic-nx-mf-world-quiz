import type { ShareCard, TranslateFn } from './share-card';
import { shareClaim, shareMedal } from './share-claim';

/** What the picture of a personal record is made of. */
export interface RecordShareFacts {
  /** The board's four settings, already translated and joined. */
  readonly board: string;
  /**
   * The figure the board ranks the run by, bare: a time ("4:07.3") or a
   * count ("21"). The label underneath says which, so the figure itself
   * stays short enough to be the big thing on the card.
   */
  readonly score: string;
  /**
   * What that figure is — "Time" or "Correct" — in the words the results
   * screen labels the same number with. The caller knows the board's
   * metric; the picture only writes it down.
   */
  readonly scoreLabel: string;
  readonly rank: number;
  readonly players: number;
  /**
   * The record was set by the run that has just finished, as opposed to one
   * the player is looking up in "My records" later. Only a fresh one is
   * news, and only news may say "New personal record!".
   */
  readonly fresh: boolean;
}

/**
 * The words of the picture a record is shared as, built outside the page so
 * they are tested without rendering it.
 *
 * The claim comes first and the score backs it up, as the one big figure
 * in the middle of the card; the place is the medal under it. A board the
 * player is alone on says so rather than boasting about being first of one
 * — "#1 of 1" invites the reader to laugh, and the honest line invites
 * them to play.
 */
export function recordShareCard(
  record: RecordShareFacts,
  translate: TranslateFn,
): ShareCard {
  const claim = shareClaim({
    personalRecord: record.fresh,
    rank: record.rank,
  });
  const alone = record.players <= 1;
  return {
    title: translate('share.title'),
    claim: translate(`share.claim.${claim}`),
    headline: record.score,
    headlineLabel: record.scoreLabel,
    subject: record.board,
    medal: alone ? null : shareMedal(record.rank),
    // The medal carries the place; this line is for the places it cannot.
    note: alone
      ? translate('share.firstOnBoard')
      : translate('leaderboard.place', {
          rank: record.rank,
          players: record.players,
        }),
    // The score is the headline and the place is the medal; a row of
    // figures repeating them would only give the reader more to skip.
    stats: [],
    callToAction: translate('share.beatMe'),
    tone: 'record',
  };
}
