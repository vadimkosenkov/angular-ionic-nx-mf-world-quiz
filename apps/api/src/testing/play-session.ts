import type { SubmitSessionRequest } from '@world-quiz/shared/contracts';
import type {
  QuizConfig,
  QuizEngine,
  SubmittedAnswer,
} from '@world-quiz/quiz/domain';

export interface PlayOptions {
  readonly id?: string;
  readonly seed?: string;
  readonly startedAt?: number;
  /** Milliseconds between two answers. */
  readonly step?: number;
  /** Which answers (by index) are deliberately wrong. */
  readonly wrong?: ReadonlySet<number>;
  /** Endless only: how many questions to answer before stopping. */
  readonly answers?: number;
}

/**
 * Plays a session the way the client does — same engine, same seed — and
 * returns the request the client would send. Tests then tamper with it to
 * check what the server refuses.
 */
export function playSession(
  engine: QuizEngine,
  config: QuizConfig,
  {
    id = crypto.randomUUID(),
    seed = 'test-seed',
    startedAt = 1_700_000_000_000,
    step = 1_000,
    wrong = new Set(),
    answers,
  }: PlayOptions = {},
): SubmitSessionRequest {
  const started = engine.start(config, { seed, startedAt });
  if (!started.ok) throw new Error(`Invalid test config: ${started.error}`);

  let session = started.value;
  const submissions: { answer: SubmittedAnswer; answeredAt: number }[] = [];
  let now = startedAt;

  while (session.status === 'active') {
    if (answers !== undefined && submissions.length >= answers) break;
    const question = engine.currentQuestion(session);
    if (!question) break;

    const index = submissions.length;
    const choice = wrong.has(index)
      ? (question.choices ?? []).find((code) => code !== question.countryCode)
      : question.countryCode;
    if (!choice) throw new Error('Wrong answers need Easy mode choices');

    now += step;
    const answer: SubmittedAnswer = { kind: 'choice', countryCode: choice };
    const result = engine.submitAnswer(session, answer, now);
    if (!result.ok) throw new Error(`Test answer refused: ${result.error}`);
    session = result.session;
    submissions.push({ answer, answeredAt: now });
  }

  return {
    id,
    config,
    seed,
    startedAt,
    finishedAt: now,
    endReason: session.status === 'finished' ? 'completed' : 'stopped',
    submissions,
  };
}
