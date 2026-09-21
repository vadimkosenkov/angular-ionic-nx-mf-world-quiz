import { COUNTRIES } from '@world-quiz/quiz/countries';
import { createQuizEngine } from '@world-quiz/quiz/domain';
import { systemClock } from '@world-quiz/shared/util';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createApp } from './app';
import { createAccessTokens } from './auth/access-tokens';
import { createAuthService } from './auth/auth-service';
import {
  createIdentityVerifier,
  remoteProviderKeys,
} from './auth/identity-verifier';
import { createRefreshTokenStore } from './auth/refresh-tokens';
import { createUserRepository } from './auth/user-repository';
import { loadConfig } from './config';
import { openPglite, openPostgres } from './db/database';
import { createSessionRepository } from './sessions/session-repository';
import { createSessionService } from './sessions/session-service';

const config = loadConfig(process.env);

const database =
  config.database.kind === 'postgres'
    ? openPostgres(config.database.url)
    : await openPglite(config.database.dataDir);

// The SQL migrations are copied next to the bundle (see project.json assets).
// Applying them at start-up suits a single API instance; with several
// instances, migrations become a separate deployment step (Phase 12).
await database.migrate(fileURLToPath(new URL('./drizzle', import.meta.url)));

if (!config.auth.jwtSecret) {
  console.warn(
    '[api] AUTH_JWT_SECRET is not set: using a random key, so every restart signs everyone out',
  );
}
const accessTokens = createAccessTokens(
  config.auth.jwtSecret ?? randomBytes(32).toString('base64url'),
);

const app = createApp({
  clock: systemClock,
  sessions: createSessionService({
    repository: createSessionRepository(database.db),
    engine: createQuizEngine(COUNTRIES),
    clock: systemClock,
  }),
  auth: createAuthService({
    users: createUserRepository(database.db),
    refreshTokens: createRefreshTokenStore(database.db),
    accessTokens,
    identities: createIdentityVerifier({
      google: {
        audiences: config.auth.googleClientIds,
        keys: remoteProviderKeys('google'),
      },
      apple: {
        audiences: config.auth.appleClientIds,
        keys: remoteProviderKeys('apple'),
      },
    }),
    clock: systemClock,
  }),
  accessTokens,
  options: {
    corsOrigins: config.corsOrigins,
    devLogin: config.auth.devLogin,
    secureCookies: config.auth.secureCookies,
  },
});

const server = app.listen(config.port, config.host, () => {
  const providers = [
    config.auth.googleClientIds.length > 0 && 'google',
    config.auth.appleClientIds.length > 0 && 'apple',
    config.auth.devLogin && 'dev',
  ].filter(Boolean);
  console.log(
    `[api] listening on http://${config.host}:${config.port} (${config.nodeEnv}, ${database.description}, sign-in: ${providers.join(', ') || 'none'})`,
  );
});

// Graceful shutdown: stop accepting connections, let in-flight requests
// finish, then close the database. `close()` alone waits for idle keep-alive
// connections to time out; closing those at once makes shutdown prompt.
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    console.log(`[api] received ${signal}, shutting down`);
    server.close(() => {
      void database.close().finally(() => process.exit(0));
    });
    server.closeIdleConnections();
  });
}
