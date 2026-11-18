import type { LeaderboardBoardId, QuizConfig } from '@world-quiz/quiz/domain';
import {
  friendProfileSchema,
  friendRequestResultSchema,
  friendsSchema,
  INVITE_CODE_ALPHABET,
  INVITE_CODE_LENGTH,
  leaderboardSchema,
} from '@world-quiz/shared/contracts';
import { sql } from 'drizzle-orm';
import request from 'supertest';
import { defaultNickname } from '../auth/nickname';
import type { DatabaseHandle } from '../db/database';
import { playSession } from '../testing/play-session';
import { createTestApi, TEST_START, type TestApi } from '../testing/test-api';
import { createTestDatabase } from '../testing/test-database';

/** A quick round over Europe: nine of the fixture's countries, ten slots. */
const EUROPE: QuizConfig = {
  category: 'capitals',
  difficulty: 'easy',
  mode: 'fixed',
  scope: 'europe',
};
const EUROPE_BOARD: LeaderboardBoardId = 'capitals-easy-europe-fixed';

interface Player {
  readonly userId: string;
  readonly authorization: string;
}

describe('friends', () => {
  let database: DatabaseHandle;
  let api: TestApi;
  let alice: Player;
  let bob: Player;
  let carol: Player;

  const as = (player: Player) => ({
    get: (path: string) =>
      request(api.app).get(path).set('Authorization', player.authorization),
    post: (path: string, body: object = {}) =>
      request(api.app)
        .post(path)
        .set('Authorization', player.authorization)
        .send(body),
    delete: (path: string) =>
      request(api.app).delete(path).set('Authorization', player.authorization),
  });

  const inviteCodeOf = async (player: Player): Promise<string> =>
    (await as(player).get('/v1/me')).body.inviteCode as string;

  const listsOf = async (player: Player) =>
    friendsSchema.parse((await as(player).get('/v1/friends')).body);

  /** Asks the owner of a player's code to be friends. */
  const ask = async (player: Player, owner: Player) =>
    as(player).post('/v1/friends/requests', {
      code: await inviteCodeOf(owner),
    });

  const befriend = async (player: Player, other: Player) => {
    await ask(player, other);
    await as(other).post(`/v1/friends/${player.userId}/accept`);
  };

  /** Plays a flawless round, the way the app does, and sends it. */
  const play = async (player: Player, step: number) => {
    const startedAt = api.clock.now();
    const session = playSession(api.engine, EUROPE, {
      startedAt,
      step,
      seed: `seed-${crypto.randomUUID()}`,
    });
    api.clock.set(session.finishedAt + 500);
    const response = await as(player).post('/v1/sessions', session);
    expect(response.status).toBe(201);
    return response;
  };

  beforeAll(async () => {
    database = await createTestDatabase();
    api = await createTestApi(database);
  });

  beforeEach(async () => {
    api.clock.set(TEST_START + 60_000);
    alice = await api.signIn('alice');
    bob = await api.signIn('bob');
    carol = await api.signIn('carol');
  });

  afterEach(async () => {
    await database.db.execute(sql`TRUNCATE users CASCADE`);
  });

  afterAll(async () => {
    await database.close();
  });

  describe('the invite code', () => {
    it('is given to every account, in the invite alphabet', async () => {
      const code = await inviteCodeOf(alice);

      expect(code).toHaveLength(INVITE_CODE_LENGTH);
      expect(
        [...code].every((character) =>
          INVITE_CODE_ALPHABET.includes(character),
        ),
      ).toBe(true);
      expect(code).not.toBe(await inviteCodeOf(bob));
    });

    it('stays the same code every time it is read', async () => {
      expect(await inviteCodeOf(alice)).toBe(await inviteCodeOf(alice));
    });
  });

  describe('asking somebody', () => {
    it('leaves a request in both players lists', async () => {
      const response = await ask(alice, bob);

      expect(response.status).toBe(201);
      expect(friendRequestResultSchema.parse(response.body)).toEqual({
        status: 'requested',
        friend: {
          id: bob.userId,
          nickname: expect.any(String),
          since: expect.any(String),
        },
      });
      expect(await listsOf(alice)).toMatchObject({
        friends: [],
        incoming: [],
        outgoing: [{ id: bob.userId }],
      });
      expect(await listsOf(bob)).toMatchObject({
        friends: [],
        incoming: [{ id: alice.userId }],
        outgoing: [],
      });
    });

    it('reads a code typed in lower case and broken up with a dash', async () => {
      const code = await inviteCodeOf(bob);
      const typed = `${code.slice(0, 4)}-${code.slice(4)}`.toLowerCase();

      const response = await as(alice).post('/v1/friends/requests', {
        code: typed,
      });

      expect(response.status).toBe(201);
      expect(response.body.friend.id).toBe(bob.userId);
    });

    it('asking twice leaves the one request', async () => {
      await ask(alice, bob);
      const again = await ask(alice, bob);

      expect(again.status).toBe(201);
      expect(again.body.status).toBe('requested');
      expect((await listsOf(alice)).outgoing).toHaveLength(1);
    });

    it('makes friends of two players who asked each other', async () => {
      await ask(alice, bob);
      const met = await ask(bob, alice);

      expect(met.status).toBe(201);
      expect(met.body.status).toBe('accepted');
      expect(await listsOf(alice)).toMatchObject({
        friends: [{ id: bob.userId }],
        incoming: [],
        outgoing: [],
      });
    });

    it('turns down the player own code', async () => {
      const response = await as(alice).post('/v1/friends/requests', {
        code: await inviteCodeOf(alice),
      });

      expect(response.status).toBe(400);
      expect(response.body.title).toBe('Your own invite code');
      expect(await listsOf(alice)).toMatchObject({ friends: [], outgoing: [] });
    });

    it('answers a code nobody holds with 404, not with who exists', async () => {
      const response = await as(alice).post('/v1/friends/requests', {
        code: 'ZZZZZZZZ',
      });

      expect(response.status).toBe(404);
      expect(response.body.detail).toBe('Nobody holds that invite code.');
    });

    it('refuses a code that is not one', async () => {
      const response = await as(alice).post('/v1/friends/requests', {
        code: 'nope',
      });

      expect(response.status).toBe(400);
      expect(response.body.title).toBe('Invalid invite code');
    });
  });

  describe('answering a request', () => {
    it('makes both players friends, from the day it was accepted', async () => {
      await ask(alice, bob);
      api.clock.advance(60_000);

      const accepted = await as(bob).post(`/v1/friends/${alice.userId}/accept`);

      expect(accepted.status).toBe(200);
      expect(friendRequestResultSchema.parse(accepted.body)).toMatchObject({
        status: 'accepted',
        friend: {
          id: alice.userId,
          since: new Date(api.clock.now()).toISOString(),
        },
      });
      expect(await listsOf(alice)).toMatchObject({
        friends: [{ id: bob.userId }],
        incoming: [],
        outgoing: [],
      });
    });

    it('declining removes the request from both lists', async () => {
      await ask(alice, bob);

      const declined = await as(bob).delete(`/v1/friends/${alice.userId}`);

      expect(declined.status).toBe(204);
      expect(await listsOf(alice)).toMatchObject({ outgoing: [] });
      expect(await listsOf(bob)).toMatchObject({ incoming: [] });
    });

    it('answers 404 when no request is waiting', async () => {
      const response = await as(bob).post(`/v1/friends/${alice.userId}/accept`);

      expect(response.status).toBe(404);
    });

    it('cannot be accepted by the player who sent it', async () => {
      await ask(alice, bob);

      const response = await as(alice).post(`/v1/friends/${bob.userId}/accept`);

      expect(response.status).toBe(404);
      expect((await listsOf(alice)).friends).toEqual([]);
    });
  });

  describe('ending a friendship', () => {
    it('removes it for both players', async () => {
      await befriend(alice, bob);

      const removed = await as(alice).delete(`/v1/friends/${bob.userId}`);

      expect(removed.status).toBe(204);
      expect((await listsOf(alice)).friends).toEqual([]);
      expect((await listsOf(bob)).friends).toEqual([]);
    });

    it('is quiet about a player who was never a friend', async () => {
      const response = await as(alice).delete(`/v1/friends/${carol.userId}`);

      expect(response.status).toBe(204);
    });

    it('happens by itself when the account is deleted', async () => {
      await befriend(alice, bob);

      await as(bob).delete('/v1/me');

      expect((await listsOf(alice)).friends).toEqual([]);
    });
  });

  describe('a friend page', () => {
    it('shows their records and what they have learned', async () => {
      // Three flawless rounds over Europe master every country in it: a
      // correct Easy answer is one of the three points mastery takes.
      await play(bob, 1_000);
      await play(bob, 1_200);
      await play(bob, 1_400);
      await befriend(alice, bob);

      const response = await as(alice).get(`/v1/friends/${bob.userId}`);

      expect(response.status).toBe(200);
      const profile = friendProfileSchema.parse(response.body);
      expect(profile.friend.id).toBe(bob.userId);
      expect(profile.records).toEqual([
        expect.objectContaining({ board: EUROPE_BOARD, rank: 1 }),
      ]);
      expect(profile.achievements).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'capitals-europe-mastered',
            status: 'unlocked',
          }),
          expect.objectContaining({
            id: 'flags-europe-mastered',
            status: 'locked',
            mastered: 0,
          }),
        ]),
      );
    });

    it('does not exist for anyone who is not their friend', async () => {
      await play(bob, 1_000);

      const stranger = await as(carol).get(`/v1/friends/${bob.userId}`);
      const pending = await (async () => {
        await ask(alice, bob);
        return as(alice).get(`/v1/friends/${bob.userId}`);
      })();

      expect(stranger.status).toBe(404);
      expect(pending.status).toBe(404);
    });

    it('answers 404 for an id that is not even an id', async () => {
      const response = await as(alice).get('/v1/friends/not-a-player');

      expect(response.status).toBe(404);
    });
  });

  describe('the board of friends', () => {
    it('ranks the player among their friends, and nobody else', async () => {
      // Carol is the fastest player in the world, and a stranger.
      await play(carol, 500);
      await play(alice, 1_000);
      await play(bob, 1_500);
      await befriend(alice, bob);

      const shared = leaderboardSchema.parse(
        (await as(alice).get(`/v1/friends/leaderboards/${EUROPE_BOARD}`)).body,
      );
      const everyone = leaderboardSchema.parse(
        (await request(api.app).get(`/v1/leaderboards/${EUROPE_BOARD}`)).body,
      );

      // The same two runs, numbered from 1: on the public board Carol's
      // run stands above both of them.
      expect(shared.players).toBe(2);
      expect(shared.entries.map((entry) => entry.rank)).toEqual([1, 2]);
      expect(shared.entries.map((entry) => entry.nickname)).toEqual([
        defaultNickname(alice.userId),
        defaultNickname(bob.userId),
      ]);
      expect(everyone.players).toBe(3);
      expect(everyone.entries.map((entry) => entry.nickname)).toEqual([
        defaultNickname(carol.userId),
        defaultNickname(alice.userId),
        defaultNickname(bob.userId),
      ]);
    });

    it('is the player alone until they have friends', async () => {
      await play(alice, 1_000);
      await play(bob, 500);

      const shared = leaderboardSchema.parse(
        (await as(alice).get(`/v1/friends/leaderboards/${EUROPE_BOARD}`)).body,
      );

      expect(shared.players).toBe(1);
      expect(shared.entries).toHaveLength(1);
      expect(shared.entries[0]?.rank).toBe(1);
    });

    it('is empty when nobody on it has a ranked run', async () => {
      await befriend(alice, bob);

      const shared = leaderboardSchema.parse(
        (await as(alice).get(`/v1/friends/leaderboards/${EUROPE_BOARD}`)).body,
      );

      expect(shared).toEqual({
        board: EUROPE_BOARD,
        players: 0,
        entries: [],
      });
    });

    it('answers 404 for a board that does not exist', async () => {
      const response = await as(alice).get(
        '/v1/friends/leaderboards/capitals-easy-europe-nonsense',
      );

      expect(response.status).toBe(404);
    });
  });

  describe('signing in', () => {
    it('is required: friends are nobody public', async () => {
      const lists = await request(api.app).get('/v1/friends');
      const profile = await request(api.app).get(`/v1/friends/${bob.userId}`);

      expect(lists.status).toBe(401);
      expect(profile.status).toBe(401);
    });

    it('keeps the lists out of every cache', async () => {
      const response = await as(alice).get('/v1/friends');

      expect(response.headers['cache-control']).toBe('no-store');
    });
  });
});
