import { createManualClock } from '@world-quiz/shared/util';
import request from 'supertest';
import { createApp } from './app';

describe('API app', () => {
  const fixedTime = Date.UTC(2026, 8, 14, 12, 0, 0);
  const app = createApp({ clock: createManualClock(fixedTime) });

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
});
