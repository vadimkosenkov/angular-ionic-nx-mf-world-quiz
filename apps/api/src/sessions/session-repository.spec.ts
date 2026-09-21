import { count, eq } from 'drizzle-orm';
import type { DatabaseHandle } from '../db/database';
import { quizAnswers, quizSessions, users } from '../db/schema';
import { readAnswers } from '../testing/read-answers';
import { createTestDatabase } from '../testing/test-database';
import { createSessionRepository, type NewSession } from './session-repository';

let ownerId: string;

const session = (id: string): NewSession => ({
  id,
  userId: ownerId,
  config: {
    category: 'flags',
    difficulty: 'hard',
    mode: 'fixed',
    scope: 'world',
    questionCount: 2,
  },
  seed: 'seed',
  startedAt: 1_000,
  finishedAt: 3_000,
  endReason: 'completed',
  answered: 2,
  correct: 1,
  durationMs: 2_000,
  completed: true,
  perfect: false,
  requestHash: 'hash',
  recordedAt: 10_000,
  answers: [
    {
      countryCode: 'fr',
      answer: { kind: 'text', text: 'Frnace' },
      correct: true,
      judgement: 'typo',
      answeredAt: 2_000,
    },
    {
      countryCode: 'de',
      answer: { kind: 'text', text: 'Austria' },
      correct: false,
      judgement: 'incorrect',
      answeredAt: 3_000,
    },
  ],
});

describe('SessionRepository', () => {
  let database: DatabaseHandle;

  beforeAll(async () => {
    database = await createTestDatabase();
    const [owner] = await database.db
      .insert(users)
      .values({ displayName: 'Owner' })
      .returning({ id: users.id });
    ownerId = owner!.id;
  });

  afterAll(async () => {
    await database.close();
  });

  it('stores a session with its answers and reads it back', async () => {
    const repository = createSessionRepository(database.db);
    const id = crypto.randomUUID();

    expect(await repository.insert(session(id))).toBe('inserted');

    const stored = await repository.findById(id);
    expect(stored?.requestHash).toBe('hash');
    expect(stored?.result.summary).toEqual({
      answered: 2,
      correct: 1,
      incorrect: 1,
      accuracy: 0.5,
      durationMs: 2_000,
      endReason: 'completed',
      completed: true,
      perfect: false,
    });
    expect(stored?.result.recordedAt).toBe(new Date(10_000).toISOString());
    expect(await readAnswers(database.db, id)).toEqual(session(id).answers);
  });

  it('writes nothing when the id already exists', async () => {
    const repository = createSessionRepository(database.db);
    const id = crypto.randomUUID();
    await repository.insert(session(id));

    expect(
      await repository.insert({ ...session(id), requestHash: 'other' }),
    ).toBe('exists');
    expect((await repository.findById(id))?.requestHash).toBe('hash');
  });

  it('deletes the answers together with their session', async () => {
    const repository = createSessionRepository(database.db);
    const id = crypto.randomUUID();
    await repository.insert(session(id));

    await database.db.delete(quizSessions).where(eq(quizSessions.id, id));

    const [row] = await database.db
      .select({ answers: count() })
      .from(quizAnswers)
      .where(eq(quizAnswers.sessionId, id));
    expect(row?.answers).toBe(0);
  });

  it('reports a missing owner instead of failing', async () => {
    const repository = createSessionRepository(database.db);

    expect(
      await repository.insert({
        ...session(crypto.randomUUID()),
        userId: crypto.randomUUID(),
      }),
    ).toBe('owner-missing');
  });

  it('enforces the invariants in the database too', async () => {
    const repository = createSessionRepository(database.db);

    await expect(
      repository.insert({ ...session(crypto.randomUUID()), correct: 3 }),
    ).rejects.toThrow();
  });
});
