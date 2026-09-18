import { QuizPage } from '@world-quiz/client/quiz-feature';
import { remoteRoutes } from './remote.routes';

describe('flags remote routes', () => {
  it('exposes the quiz page for the Flags category', async () => {
    const [route] = remoteRoutes;

    expect(remoteRoutes).toHaveLength(1);
    expect(route?.path).toBe('');
    expect(route?.data).toEqual({ category: 'flags' });
    expect(await route?.loadComponent?.()).toBe(QuizPage);
  });
});
