import { reflectComponentType, type Type } from '@angular/core';
import { remoteRoutes } from './remote.routes';

describe('capitals remote routes', () => {
  it('exposes the quiz page for the Capitals category', async () => {
    const [route] = remoteRoutes;

    expect(remoteRoutes).toHaveLength(1);
    expect(route?.path).toBe('');
    expect(route?.data).toEqual({ category: 'capitals' });
    // QuizPage is not exported from the library barrel, so that it stays in
    // its own lazily loaded chunk; identify it by its selector instead.
    const page = (await route?.loadComponent?.()) as Type<unknown>;
    expect(reflectComponentType(page)?.selector).toBe('wq-quiz-page');
  });
});
