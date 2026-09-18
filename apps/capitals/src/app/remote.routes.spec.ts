import { QuizPage } from '@world-quiz/client/quiz-feature';
import { remoteRoutes } from './remote.routes';

describe('capitals remote routes', () => {
  it('exposes the quiz page for the Capitals category', async () => {
    const [route] = remoteRoutes;

    expect(remoteRoutes).toHaveLength(1);
    expect(route?.path).toBe('');
    expect(route?.data).toEqual({ category: 'capitals' });
    expect(await route?.loadComponent?.()).toBe(QuizPage);
  });
});
