import { submitSessionRequestSchema } from '@world-quiz/shared/contracts';
import { sessionProgressEvents } from '@world-quiz/quiz/domain';
import { playedSession, pulledSession } from './session-mapping';
import { finishedSession, historyEntry } from '../testing';

describe('playedSession', () => {
  const played = finishedSession([
    { code: 'fr', correct: true },
    { code: 'de', correct: false },
  ]);

  it('sends only what the player did, in the shape the API accepts', () => {
    const { request } = playedSession(
      played,
      'b0e5c0de-0000-4000-8000-000000000001',
    );

    expect(submitSessionRequestSchema.parse(request)).toEqual(request);
    expect(request).not.toHaveProperty('score');
    expect(request?.submissions).toEqual([
      { answer: { kind: 'choice', countryCode: 'fr' }, answeredAt: 1_001_000 },
      { answer: { kind: 'choice', countryCode: 'de' }, answeredAt: 1_002_000 },
    ]);
  });

  it('names the challenge a leaderboard run played, and only then', () => {
    expect(playedSession(played, 'id-1', 'challenge-1').request).toMatchObject({
      challengeId: 'challenge-1',
    });
    expect(playedSession(played, 'id-2').request).not.toHaveProperty(
      'challengeId',
    );
  });

  it('starts in the outbox, with the progress events the domain derives', () => {
    const local = playedSession(played, 'id-1');

    expect(local.sync).toBe('pending');
    expect(local.events).toEqual(sessionProgressEvents(played, 'id-1'));
  });

  it('refuses a session that has not finished', () => {
    expect(() =>
      playedSession(
        { ...played, finishedAt: null, endReason: null, status: 'active' },
        'id',
      ),
    ).toThrow();
  });
});

describe('pulledSession', () => {
  it('turns server-graded answers into the same events the playing device had', () => {
    const played = finishedSession([
      { code: 'fr', correct: true },
      { code: 'de', correct: false },
    ]);
    const entry = historyEntry(
      'id-1',
      [
        { code: 'fr', correct: true },
        { code: 'de', correct: false },
      ],
      { startedAt: played.startedAt },
    );

    const pulled = pulledSession(entry);

    expect(pulled.sync).toBe('synced');
    expect(pulled.request).toBeUndefined();
    expect(pulled.events).toEqual(sessionProgressEvents(played, 'id-1'));
  });
});
