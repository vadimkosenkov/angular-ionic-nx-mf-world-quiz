import { createServer, type Server } from 'node:http';
import type { Express } from 'express';

/**
 * Serves the app on 127.0.0.1 for supertest, on a free port.
 *
 * `request(app)` would listen on all addresses (`::`) and then connect to
 * 127.0.0.1. On macOS the port it gets may already be taken on 127.0.0.1
 * alone by another program (an IDE's built-in server, a database tool…), and
 * the test then talks to that program: rare, random 403/404/`{}` answers.
 * Listening on 127.0.0.1 itself can only get a port that is free there.
 *
 * The server does not keep the test process alive (`unref`).
 */
export async function onLoopback(app: Express): Promise<Server> {
  const server = createServer(app);
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve());
  });
  server.unref();
  return server;
}
