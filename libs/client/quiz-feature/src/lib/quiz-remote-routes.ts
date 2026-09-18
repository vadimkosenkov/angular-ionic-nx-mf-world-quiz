import type { Routes } from '@angular/router';
import type { QuizCategory } from '@world-quiz/quiz/domain';

/**
 * The routes a quiz microfrontend exposes as `./routes`: one page, told its
 * category through route `data` (bound to `QuizPage.category`).
 *
 * The remotes differ only in this category, so they share the page instead
 * of copying it; each remote is still built, served and deployed on its own.
 */
export function quizRemoteRoutes(category: QuizCategory): Routes {
  return [
    {
      path: '',
      data: { category },
      loadComponent: () =>
        import('./quiz-page/quiz-page').then((m) => m.QuizPage),
    },
  ];
}
