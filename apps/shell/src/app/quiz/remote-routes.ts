import { loadRemoteModule } from '@angular-architects/native-federation';
import { ErrorHandler, inject } from '@angular/core';
import type { Routes } from '@angular/router';
import type { QuizRemoteRoutesModule } from '@world-quiz/client/quiz-ports';
import { RemoteUnavailablePage } from './remote-unavailable.page';

/** Route shown instead of the quiz when its remote cannot be loaded. */
const unavailableRoutes: Routes = [
  { path: '**', component: RemoteUnavailablePage },
];

/**
 * Loads the routes a quiz microfrontend exposes.
 *
 * `loadRemoteModule` fetches the remote's entry point over the network (on the
 * web the remote is a separate deployment), so this can fail for reasons the
 * shell does not control. Reporting the error and falling back to a message
 * keeps navigation working instead of leaving a blank router outlet.
 *
 * Called from a route's `loadChildren`, which Angular runs in an injection
 * context.
 */
export function loadQuizRemoteRoutes(remoteName: string): Promise<Routes> {
  const errorHandler = inject(ErrorHandler);

  return loadRemoteModule<QuizRemoteRoutesModule>(remoteName, './routes')
    .then((module) => module.remoteRoutes)
    .catch((error: unknown) => {
      errorHandler.handleError(error);
      return unavailableRoutes;
    });
}
