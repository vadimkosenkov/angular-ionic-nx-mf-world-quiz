import {
  type CountryDataset,
  evaluateChallengeRun,
  isNewPersonalRecord,
  type QuizSession,
  type SessionSummary,
} from '@world-quiz/quiz/domain';

/** How long a challenge can be played after it was issued. */
export const CHALLENGE_LIFETIME_MS = 3 * 60 * 60 * 1000;
/**
 * How much shorter the run's own time may be than the server's window
 * (challenge issued → result received): loading the quiz and sending the
 * result. A longer gap means the result was not sent right after the run.
 */
export const CHALLENGE_TIME_TOLERANCE_MS = 60_000;
/** Clock drift between device and server the run's time may show. */
export const CHALLENGE_CLOCK_ALLOWANCE_MS = 2_000;

export interface ChallengeRun {
  /** The session as the server replayed it, and its summary. */
  readonly session: QuizSession;
  readonly summary: SessionSummary;
  readonly dataset: CountryDataset;
  /** Server times, epoch milliseconds. */
  readonly issuedAt: number;
  readonly receivedAt: number;
  /** The player's best ranked time on the board before this run. */
  readonly previousBestMs: number | null;
}

export interface ChallengeJudgement {
  /** `ranked`, or a `ChallengeUnrankedReason`. */
  readonly outcome: string;
  readonly completionMs: number | null;
  readonly personalRecord: boolean;
}

/**
 * Whether a challenge run is ranked (docs/domain/leaderboard.md).
 *
 * The domain decides eligibility: complete, all 195 countries, every answer
 * correct. The time that ranks is the run's own, measured on the device from
 * the first question to the last answer — precise and independent of the
 * network. The server checks it against what it saw itself: the run cannot
 * take longer than the time between issuing the challenge and receiving the
 * result, and may be shorter only by the tolerance. A client cannot claim to
 * be faster by more than that, and a result sent later is not ranked.
 */
export function judgeChallengeRun(run: ChallengeRun): ChallengeJudgement {
  const evaluation = evaluateChallengeRun(
    run.session,
    run.summary,
    run.dataset,
  );
  if (!evaluation.eligible) {
    return {
      outcome: evaluation.reason,
      completionMs: null,
      personalRecord: false,
    };
  }

  const completionMs = evaluation.completionTimeMs;
  const window = run.receivedAt - run.issuedAt;
  const unranked = (outcome: string): ChallengeJudgement => ({
    outcome,
    completionMs,
    personalRecord: false,
  });
  if (window > CHALLENGE_LIFETIME_MS) return unranked('expired');
  if (completionMs > window + CHALLENGE_CLOCK_ALLOWANCE_MS) {
    return unranked('implausible-time');
  }
  if (window - completionMs > CHALLENGE_TIME_TOLERANCE_MS) {
    return unranked('late');
  }
  return {
    outcome: 'ranked',
    completionMs,
    personalRecord: isNewPersonalRecord(run.previousBestMs, completionMs),
  };
}
