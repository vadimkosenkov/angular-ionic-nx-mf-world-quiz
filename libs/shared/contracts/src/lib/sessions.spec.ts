import type { QuizConfig, SessionRecord } from '@world-quiz/quiz/domain';
import {
  DEFAULT_HISTORY_PAGE_SIZE,
  LEGACY_CHALLENGE_QUESTION_COUNT,
  MAX_HISTORY_PAGE_SIZE,
  MAX_SUBMISSIONS_PER_SESSION,
  parsePostedSession,
  sessionHistoryQuerySchema,
  type SubmitSessionRequest,
  submitSessionRequestSchema,
} from './sessions';

const validRequest = (): SubmitSessionRequest => ({
  id: '0b8f1f6e-6f0e-4c1a-9a55-6a1f2f3e4d5c',
  config: {
    category: 'capitals',
    difficulty: 'easy',
    mode: 'fixed',
    scope: 'europe',
    questionCount: 2,
  },
  seed: 'seed-1',
  startedAt: 1_000,
  finishedAt: 5_000,
  endReason: 'completed',
  submissions: [
    { answer: { kind: 'choice', countryCode: 'fr' }, answeredAt: 2_000 },
    { answer: { kind: 'text', text: 'Berlin' }, answeredAt: 5_000 },
  ],
});

/** Paths of the issues Zod reports, e.g. `config.mode`. */
function issuePaths(input: unknown): string[] {
  const result = submitSessionRequestSchema.safeParse(input);
  return result.success
    ? []
    : result.error.issues.map((issue) => issue.path.join('.'));
}

describe('submitSessionRequestSchema', () => {
  it('accepts a finished session as the client played it', () => {
    expect(submitSessionRequestSchema.parse(validRequest())).toEqual(
      validRequest(),
    );
  });

  it('is exactly what the domain replays', () => {
    // Compile-time check: a request is a domain `SessionRecord` and its config
    // a domain `QuizConfig`, so the server can replay it without mapping.
    const record: SessionRecord = validRequest();
    const config: QuizConfig = record.config;
    expect(config.category).toBe('capitals');
  });

  it.each([
    ['config.mode', { config: { ...validRequest().config, mode: 'marathon' } }],
    ['config.scope', { config: { ...validRequest().config, scope: 'mars' } }],
    ['id', { id: 'not-a-uuid' }],
    ['startedAt', { startedAt: -1 }],
    ['finishedAt', { finishedAt: 1.5 }],
    ['endReason', { endReason: 'abandoned' }],
    ['seed', { seed: '' }],
  ])('rejects an invalid %s', (path, override) => {
    expect(issuePaths({ ...validRequest(), ...override })).toContain(path);
  });

  it('normalises the id to lower case, as PostgreSQL stores it', () => {
    const upper = { ...validRequest(), id: validRequest().id.toUpperCase() };

    expect(submitSessionRequestSchema.parse(upper).id).toBe(validRequest().id);
  });

  it('rejects results the client must never claim', () => {
    // Score and correctness are computed by the server from the answers.
    expect(issuePaths({ ...validRequest(), score: 10 })).toEqual(['']);
    expect(
      issuePaths({
        ...validRequest(),
        submissions: [
          {
            answer: { kind: 'choice', countryCode: 'fr' },
            answeredAt: 2_000,
            correct: true,
          },
        ],
      }),
    ).toEqual(['submissions.0']);
  });

  it('rejects malformed answers', () => {
    const withAnswer = (answer: unknown) => ({
      ...validRequest(),
      submissions: [{ answer, answeredAt: 2_000 }],
    });

    expect(
      issuePaths(withAnswer({ kind: 'choice', countryCode: 'FRA' })),
    ).toEqual(['submissions.0.answer.countryCode']);
    expect(
      issuePaths(withAnswer({ kind: 'text', text: 'x'.repeat(101) })),
    ).toEqual(['submissions.0.answer.text']);
    expect(issuePaths(withAnswer({ kind: 'voice' }))).toEqual([
      'submissions.0.answer.kind',
    ]);
  });

  it('caps the number of answers in one request', () => {
    const submissions = Array.from(
      { length: MAX_SUBMISSIONS_PER_SESSION + 1 },
      () => ({
        answer: { kind: 'choice', countryCode: 'fr' },
        answeredAt: 2_000,
      }),
    );
    expect(issuePaths({ ...validRequest(), submissions })).toEqual([
      'submissions',
    ]);
  });
});

describe('sessionHistoryQuerySchema', () => {
  it('reads query strings, with a default page size', () => {
    expect(sessionHistoryQuerySchema.parse({})).toEqual({
      limit: DEFAULT_HISTORY_PAGE_SIZE,
    });
    expect(
      sessionHistoryQuerySchema.parse({ after: 'MTcwMDA6YWJj', limit: '10' }),
    ).toEqual({ after: 'MTcwMDA6YWJj', limit: 10 });
  });

  it.each([
    [{ limit: '0' }],
    [{ limit: String(MAX_HISTORY_PAGE_SIZE + 1) }],
    [{ limit: '2.5' }],
    [{ after: 'not a cursor!' }],
    [{ after: '' }],
    [{ since: '0' }],
  ])('rejects %j', (query) => {
    expect(sessionHistoryQuerySchema.safeParse(query).success).toBe(false);
  });
});

/**
 * The body an app of the time wrote for a leaderboard challenge, which a
 * device that played one offline may still be holding (ADR-014).
 */
const legacyChallengeRequest = () => ({
  ...validRequest(),
  config: {
    category: 'capitals',
    difficulty: 'easy',
    mode: 'challenge',
    scope: 'world',
  },
  challengeId: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
});

describe('parsePostedSession', () => {
  it('reads a current body as it is', () => {
    const parsed = parsePostedSession(validRequest());

    expect(parsed).toMatchObject({ ok: true, legacy: false });
  });

  it('says a legacy challenge in the vocabulary that is left', () => {
    const parsed = parsePostedSession(legacyChallengeRequest());

    expect(parsed.ok && parsed.legacy).toBe(true);
    expect(parsed.ok && parsed.request.config).toEqual({
      category: 'capitals',
      difficulty: 'easy',
      scope: 'world',
      mode: 'fixed',
      questionCount: LEGACY_CHALLENGE_QUESTION_COUNT,
    });
  });

  it('keeps the answers, the seed and the times of a legacy session untouched', () => {
    const legacy = legacyChallengeRequest();

    const parsed = parsePostedSession(legacy);

    expect(parsed.ok && parsed.request).toMatchObject({
      id: legacy.id,
      seed: legacy.seed,
      startedAt: legacy.startedAt,
      finishedAt: legacy.finishedAt,
      endReason: legacy.endReason,
      submissions: legacy.submissions,
    });
  });

  it('drops the challenge it answered: there is nothing left to check it against', () => {
    const parsed = parsePostedSession(legacyChallengeRequest());

    expect(parsed.ok && 'challengeId' in parsed.request).toBe(false);
  });

  it('translates the same body the same way, so a retry hashes the same', () => {
    const legacy = legacyChallengeRequest();

    const first = parsePostedSession(legacy);
    const second = parsePostedSession(legacy);

    expect(first).toEqual(second);
  });

  it('refuses a challenge over a region: a challenge was always the World set', () => {
    const parsed = parsePostedSession({
      ...legacyChallengeRequest(),
      config: {
        category: 'capitals',
        difficulty: 'easy',
        mode: 'challenge',
        scope: 'europe',
      },
    });

    expect(parsed.ok).toBe(false);
  });

  it('reports the current contract errors for an ordinary broken body', () => {
    const parsed = parsePostedSession({ ...validRequest(), id: 'x' });

    expect(parsed.ok).toBe(false);
    expect(
      !parsed.ok && parsed.error.issues.map((issue) => issue.path.join('.')),
    ).toEqual(['id']);
  });
});
