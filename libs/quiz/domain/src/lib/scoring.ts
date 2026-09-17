import type { CountryCode } from './country';
import type { QuizSession, SessionEndReason } from './session';

/**
 * Result of a session, derived only from its recorded answers.
 *
 * How the UI presents the score depends on the mode:
 * - Fixed / Challenge: `correct / totalQuestions` (e.g. 9/10)
 * - Timed: `correct` (e.g. "17 correct answers")
 * - Endless: `correct / answered`
 */
export interface SessionSummary {
  /** Planned number of questions; `null` for Endless and Timed. */
  readonly totalQuestions: number | null;
  readonly answered: number;
  readonly correct: number;
  readonly incorrect: number;
  /** `correct / answered`, or 0 when nothing was answered. */
  readonly accuracy: number;
  /** Time from start to finish; `null` while the session is active. */
  readonly durationMs: number | null;
  readonly endReason: SessionEndReason | null;
  /** Every planned question was answered (always false for Endless/Timed). */
  readonly completed: boolean;
  /** Completed with zero incorrect answers. */
  readonly perfect: boolean;
  /** Countries answered incorrectly at least once in this session, in order of first mistake. */
  readonly mistakes: readonly CountryCode[];
}

export function summarizeSession(
  session: QuizSession,
  totalQuestions: number | null,
): SessionSummary {
  const answered = session.answers.length;
  const correct = session.answers.filter((answer) => answer.correct).length;
  const incorrect = answered - correct;
  const completed =
    session.endReason === 'completed' &&
    totalQuestions !== null &&
    answered === totalQuestions;

  const mistakes: CountryCode[] = [];
  for (const answer of session.answers) {
    if (!answer.correct && !mistakes.includes(answer.countryCode)) {
      mistakes.push(answer.countryCode);
    }
  }

  return {
    totalQuestions,
    answered,
    correct,
    incorrect,
    accuracy: answered === 0 ? 0 : correct / answered,
    durationMs:
      session.finishedAt === null
        ? null
        : session.finishedAt - session.startedAt,
    endReason: session.endReason,
    completed,
    perfect: completed && incorrect === 0,
    mistakes,
  };
}
