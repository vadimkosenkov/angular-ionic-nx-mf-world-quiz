import { systemClock } from '@world-quiz/shared/util';
import { createApp } from './app';
import { loadConfig } from './config';

const config = loadConfig(process.env);
const app = createApp({ clock: systemClock });

const server = app.listen(config.port, config.host, () => {
  console.log(
    `[api] listening on http://${config.host}:${config.port} (${config.nodeEnv})`,
  );
});

// Graceful shutdown: stop accepting connections and let in-flight requests finish.
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    console.log(`[api] received ${signal}, shutting down`);
    server.close(() => process.exit(0));
  });
}
