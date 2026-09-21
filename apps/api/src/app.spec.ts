import { createManualClock } from '@world-quiz/shared/util';
import request from 'supertest';
import { createApp } from './app';
import type { SessionService } from './sessions/session-service';

/** The health and fallback routes need no sessions. */
const unusedSessions: SessionService = {
  submit: () => Promise.reject(new Error('not used')),
  find: () => Promise.reject(new Error('not used')),
};

describe('API app', () => {
  const fixedTime = Date.UTC(2026, 8, 14, 12, 0, 0);
  const app = createApp({
    clock: createManualClock(fixedTime),
    sessions: unusedSessions,
  });

  describe('GET /health', () => {
    it('reports status and the injected clock time', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toMatch(/^application\/json/);
      expect(response.body).toEqual({
        status: 'ok',
        time: '2026-09-14T12:00:00.000Z',
      });
    });

    it('does not expose the framework in response headers', async () => {
      const response = await request(app).get('/health');

      expect(response.headers['x-powered-by']).toBeUndefined();
    });
  });

  describe('unknown routes', () => {
    it('respond with a 404 problem-details body', async () => {
      const response = await request(app).post('/does-not-exist');

      expect(response.status).toBe(404);
      expect(response.headers['content-type']).toMatch(
        /^application\/problem\+json/,
      );
      expect(response.body).toEqual({
        type: 'about:blank',
        title: 'Not Found',
        status: 404,
        detail: 'No route matches POST /does-not-exist',
      });
    });
  });

  describe('unexpected errors', () => {
    it('answer 500 without leaking the error, and log it', async () => {
      const logged: unknown[] = [];
      const failing = createApp({
        clock: createManualClock(fixedTime),
        sessions: {
          ...unusedSessions,
          find: () => Promise.reject(new Error('connection to db-7 refused')),
        },
        logError: (error) => logged.push(error),
      });

      const response = await request(failing).get(
        '/v1/sessions/0b8f1f6e-6f0e-4c1a-9a55-6a1f2f3e4d5c',
      );

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        type: 'about:blank',
        title: 'Internal Server Error',
        status: 500,
        detail: 'The request could not be completed.',
      });
      expect(JSON.stringify(response.body)).not.toContain('db-7');
      expect(logged).toHaveLength(1);
    });
  });
});
