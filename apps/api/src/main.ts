import { COUNTRIES } from '@world-quiz/quiz/countries';
import { createQuizEngine } from '@world-quiz/quiz/domain';
import { systemClock } from '@world-quiz/shared/util';
import { fileURLToPath } from 'node:url';
import { createApp } from './app';
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

const app = createApp({
  clock: systemClock,
  sessions: createSessionService({
    repository: createSessionRepository(database.db),
    engine: createQuizEngine(COUNTRIES),
    clock: systemClock,
  }),
});

const server = app.listen(config.port, config.host, () => {
  console.log(
    `[api] listening on http://${config.host}:${config.port} (${config.nodeEnv}, ${database.description})`,
  );
});

// Graceful shutdown: stop accepting connections, let in-flight requests
// finish, then close the database.
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    console.log(`[api] received ${signal}, shutting down`);
    server.close(() => {
      void database.close().finally(() => process.exit(0));
    });
  });
}
