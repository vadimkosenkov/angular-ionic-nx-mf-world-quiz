/**
 * What a shared picture says about itself, in the player's own voice.
 *
 * A picture that leads with a number ("0:34.8") makes the person who
 * receives it work: they have to find the small print to learn whether that
 * is good. The first line is therefore a claim — the thing the player would
 * have typed above the picture — and the number is what backs it up.
 *
 * The claim is chosen from what the run actually achieved, best first. It is
 * a key rather than a sentence, because `client/ui` holds no translations.
 */
export type ShareClaim =
  'record' | 'first' | 'topThree' | 'ranked' | 'perfect' | 'plain';

/** What the claim is decided from. Everything is optional; nothing lies. */
export interface ShareClaimFacts {
  /** The run has just beaten this player's own best on its board. */
  readonly personalRecord?: boolean;
  /** The place the run holds, when it is on a board at all. */
  readonly rank?: number | null;
  /**
   * How many players that board holds. A board of one is nobody to have
   * beaten, so a place on it is no claim; left out, the board is assumed
   * to have others on it.
   */
  readonly players?: number | null;
  /** Every answer correct. */
  readonly perfect?: boolean;
}

/** The three places that are worth their own word. */
const TOP_THREE = 3;

/**
 * The loudest true thing about a run.
 *
 * A new record wins over a place, because it is news: a player who is
 * second and has just beaten their own best would rather say so. Below the
 * board, a flawless run is still worth a sentence — Endless and Practice
 * Mistakes are never ranked, and they can be played perfectly.
 *
 * A place on a board nobody else is on claims nothing: "I'm #1 on the
 * board!" when the board holds one player is the kind of boast that
 * invites laughter, which is why the picture writes "First result on this
 * board" there instead of a medal.
 */
export function shareClaim(facts: ShareClaimFacts): ShareClaim {
  if (facts.personalRecord) return 'record';
  const rank = facts.rank ?? null;
  const alone = (facts.players ?? Number.POSITIVE_INFINITY) <= 1;
  if (rank !== null && !alone) {
    if (rank === 1) return 'first';
    if (rank <= TOP_THREE) return 'topThree';
    return 'ranked';
  }
  return facts.perfect ? 'perfect' : 'plain';
}

/** The medal a place earns on the picture, or `null` below the third. */
export function shareMedal(rank: number | null | undefined): 1 | 2 | 3 | null {
  if (rank === 1 || rank === 2 || rank === 3) return rank;
  return null;
}
