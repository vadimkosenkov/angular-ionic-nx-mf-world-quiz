import type { Route } from '@angular/router';
import { provideDevQuizPorts } from './dev/dev-quiz-ports';

/**
 * Routes of the standalone dev app. In production this remote has no routes
 * of its own: the shell mounts `remote.routes.ts` and supplies the ports.
 * Here the same routes run against in-memory ports.
 */
export const appRoutes: Route[] = [
  {
    path: 'quiz',
    providers: [provideDevQuizPorts()],
    loadChildren: () => import('./remote.routes').then((m) => m.remoteRoutes),
  },
  { path: '', pathMatch: 'full', redirectTo: 'quiz' },
  { path: '**', redirectTo: 'quiz' },
];
