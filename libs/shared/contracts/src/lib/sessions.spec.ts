import type { QuizConfig, SessionRecord } from '@world-quiz/quiz/domain';
import {
  MAX_SUBMISSIONS_PER_SESSION,
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
