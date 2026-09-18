import { quizRemoteRoutes } from '@world-quiz/client/quiz-feature';
import type { QuizRemoteRoutesModule } from '@world-quiz/client/quiz-ports';

/**
 * The routes this microfrontend exposes (`./routes` in federation.config.mjs).
 *
 * The host mounts them with `loadChildren`, so lazy loading, guards and the
 * back button keep working across the microfrontend boundary. Providers such
 * as `QUIZ_RESULT_SINK` come from whoever mounts these routes: the shell in
 * production, the standalone dev app when this remote runs on its own.
 *
 * Typing the module as `QuizRemoteRoutesModule` makes the contract with the
 * host a compile-time check, even though the module itself is only resolved
 * at runtime.
 */
const routesModule: QuizRemoteRoutesModule = {
  remoteRoutes: quizRemoteRoutes('flags'),
};

export const remoteRoutes = routesModule.remoteRoutes;
