/// <reference types="cypress" />
/**
 * Playing the quiz in E2E journeys. The prompt carries the asked country's
 * code (`data-country-code`), so a test can answer without knowing the
 * question order, which comes from a random seed.
 */

export const byTestId = (
  testId: string,
  options?: Partial<Cypress.Timeoutable>,
) => cy.get(`[data-testid="${testId}"]`, options);

/** The code of the country asked now; waits for the remote to load. */
export const askedCountry = () =>
  cy
    .get('[data-testid="quiz-prompt"]', { timeout: 20_000 })
    .invoke('attr', 'data-country-code')
    .then((code) => {
      expect(code, 'asked country').to.be.a('string');
      return code as string;
    });

/** Answers the visible Easy question, then leaves the feedback. */
export const answerChoice = (correctly: boolean) => {
  askedCountry().then((code) => {
    const correctChoice = `[data-testid="quiz-choice-${code}"]`;
    if (correctly) cy.get(correctChoice).click();
    else
      cy.get('[data-testid="quiz-choices"] button')
        .not(correctChoice)
        .first()
        .click();
  });
  byTestId('quiz-continue').click();
};

type QuizTimeWindow = Cypress.AUTWindow & {
  advanceQuizTime?: (ms: number) => void;
};

/**
 * For `cy.visit(path, { onBeforeLoad: controlQuizTime })`: the quiz's
 * `CLOCK` reads `performance.now()`, so shifting it lets a test end a
 * 60-second Time attack at once, while timers, Angular and the network keep
 * running on real time (`cy.clock()` would freeze those too).
 */
export const controlQuizTime = (win: Cypress.AUTWindow) => {
  const realNow = win.performance.now.bind(win.performance);
  let offset = 0;
  win.performance.now = () => realNow() + offset;
  (win as QuizTimeWindow).advanceQuizTime = (ms) => {
    offset += ms;
  };
};

/** Moves the quiz's clock forward (see `controlQuizTime`). */
export const advanceQuizTime = (ms: number) =>
  cy.window().then((win) => {
    const advance = (win as QuizTimeWindow).advanceQuizTime;
    expect(advance, 'page visited with controlQuizTime').to.be.a('function');
    advance?.(ms);
  });

export interface CountryKey {
  readonly code: string;
  readonly name: { readonly en: string; readonly ru: string };
  readonly capital: { readonly en: string; readonly ru: string };
}

/** The asked country's names and capital, from the dataset (`country` task). */
export const askedCountryKey = () =>
  askedCountry().then((code) =>
    cy.task<CountryKey | null>('country', code).then((country) => {
      expect(country, `country ${code} in the dataset`).to.be.an('object');
      return country as CountryKey;
    }),
  );
