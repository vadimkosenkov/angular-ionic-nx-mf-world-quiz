import { createQuizEngine } from '@world-quiz/quiz/domain';
import { FIXTURE_DATASET } from '@world-quiz/quiz/domain/testing';
import { playSession } from '../testing/play-session';
import {
  CHALLENGE_CLOCK_ALLOWANCE_MS,
  CHALLENGE_LIFETIME_MS,
  CHALLENGE_TIME_TOLERANCE_MS,
  judgeChallengeRun,
} from './challenge-rules';

const engine = createQuizEngine(FIXTURE_DATASET);
const ISSUED = 1_700_000_000_000;

/** A perfect challenge run that starts `startDelayMs` after it was issued. */
function perfectRun(
  startDelayMs = 1_000,
  previousBestMs: number | null = null,
) {
  const record = playSession(
    engine,
    {
      category: 'capitals',
      difficulty: 'easy',
      mode: 'challenge',
      scope: 'world',
    },
    { seed: 'challenge-seed', startedAt: ISSUED + startDelayMs },
  );
  const replayed = engine.replay(record);
  if (!replayed.ok) throw new Error('The run must replay');
  const session = replayed.value;
  const completionMs = record.finishedAt - record.startedAt;
  const judge = (receivedAt: number) =>
    judgeChallengeRun({
      session,
      summary: engine.summarize(session),
      dataset: FIXTURE_DATASET,
      issuedAt: ISSUED,
      receivedAt,
      previousBestMs,
    });
  return { record, completionMs, judge };
}

describe('judgeChallengeRun', () => {
  it('ranks a run whose time is within the tolerance of the server window', () => {
    const { record, completionMs, judge } = perfectRun(0);
    const lastMoment = ISSUED + completionMs + CHALLENGE_TIME_TOLERANCE_MS;

    expect(judge(record.finishedAt)).toEqual({
      outcome: 'ranked',
      completionMs,
      personalRecord: true,
    });
    expect(judge(lastMoment).outcome).toBe('ranked');
    expect(judge(lastMoment + 1).outcome).toBe('late');
  });

  it('allows a little clock drift, but not a run longer than the window', () => {
    const { completionMs, judge } = perfectRun(0);

    expect(
      judge(ISSUED + completionMs - CHALLENGE_CLOCK_ALLOWANCE_MS).outcome,
    ).toBe('ranked');
    expect(
      judge(ISSUED + completionMs - CHALLENGE_CLOCK_ALLOWANCE_MS - 1).outcome,
    ).toBe('implausible-time');
  });

  it('does not rank a run received after the challenge expired', () => {
    const { judge } = perfectRun();

    expect(judge(ISSUED + CHALLENGE_LIFETIME_MS + 1)).toMatchObject({
      outcome: 'expired',
      personalRecord: false,
    });
  });

  it('is a personal record only when strictly faster than the previous best', () => {
    const { record, completionMs } = perfectRun(0);
    const judgeAgainst = (previousBestMs: number) =>
      perfectRun(0, previousBestMs).judge(record.finishedAt).personalRecord;

    expect(judgeAgainst(completionMs + 1)).toBe(true);
    expect(judgeAgainst(completionMs)).toBe(false);
  });
});
