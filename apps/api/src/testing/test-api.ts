import { createQuizEngine, type QuizEngine } from '@world-quiz/quiz/domain';
import { FIXTURE_DATASET } from '@world-quiz/quiz/domain/testing';
import { createManualClock, type ManualClock } from '@world-quiz/shared/util';
import type { Express } from 'express';
import request from 'supertest';
import { type AppOptions, createApp } from '../app';
import { createAccessTokens } from '../auth/access-tokens';
import { createAuthService } from '../auth/auth-service';
import { createIdentityVerifier } from '../auth/identity-verifier';
import { createRefreshTokenStore } from '../auth/refresh-tokens';
import { createUserRepository } from '../auth/user-repository';
import type { DatabaseHandle } from '../db/database';
import { createSessionRepository } from '../sessions/session-repository';
import { createSessionService } from '../sessions/session-service';
import {
  APPLE_CLIENT_ID,
  createFakeIdentityProvider,
  type FakeIdentityProvider,
  GOOGLE_CLIENT_ID,
} from './fake-identity-provider';

export const TEST_START = 1_700_000_000_000;
export const TEST_JWT_SECRET = 'test-secret-that-is-at-least-32-characters';

export interface TestApi {
  readonly app: Express;
  readonly clock: ManualClock;
  readonly engine: QuizEngine;
  readonly provider: FakeIdentityProvider;
  /** Signs in through the dev endpoint; returns a bearer header. */
  signIn(subject?: string): Promise<{ userId: string; authorization: string }>;
}

/**
 * The whole API with real services over the given database, the fixture
 * dataset, a manual clock and a fake identity provider for Google and Apple.
 */
export async function createTestApi(
  database: DatabaseHandle,
  options: Partial<AppOptions> = {},
  /** Providers with a configured client id; the others are disabled. */
  configuredProviders: readonly ('google' | 'apple')[] = ['google', 'apple'],
): Promise<TestApi> {
  const clock = createManualClock(TEST_START + 60_000);
  const engine = createQuizEngine(FIXTURE_DATASET);
  const provider = await createFakeIdentityProvider(() => clock.now());
  const accessTokens = createAccessTokens(TEST_JWT_SECRET);

  const app = createApp({
    clock,
    accessTokens,
    sessions: createSessionService({
      repository: createSessionRepository(database.db),
      engine,
      clock,
    }),
    auth: createAuthService({
      users: createUserRepository(database.db),
      refreshTokens: createRefreshTokenStore(database.db),
      accessTokens,
      identities: createIdentityVerifier({
        google: {
          audiences: configuredProviders.includes('google')
            ? [GOOGLE_CLIENT_ID]
            : [],
          keys: provider.keys,
        },
        apple: {
          audiences: configuredProviders.includes('apple')
            ? [APPLE_CLIENT_ID]
            : [],
          keys: provider.keys,
        },
      }),
      clock,
    }),
    options: {
      devLogin: true,
      secureCookies: true,
      authRateLimit: 1_000,
      corsOrigins: ['http://localhost:4200'],
      ...options,
    },
    logError: () => undefined,
  });

  return {
    app,
    clock,
    engine,
    provider,
    async signIn(subject = 'player-1') {
      const response = await request(app)
        .post('/v1/auth/dev')
        .send({ subject, refreshTokenIn: 'body' });
      if (response.status !== 200) {
        throw new Error(`Test sign-in failed: ${response.status}`);
      }
      return {
        userId: response.body.user.id as string,
        authorization: `Bearer ${response.body.accessToken as string}`,
      };
    },
  };
}
