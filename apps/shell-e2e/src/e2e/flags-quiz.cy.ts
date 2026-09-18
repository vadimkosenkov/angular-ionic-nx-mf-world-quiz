/**
 * The Flags journey: the same shell, a second microfrontend. The quiz is
 * fetched at runtime from the `flags` remote (http://localhost:4202).
 */
describe('flags quiz', () => {
  /** Answers the visible question; the prompt carries the country code. */
  const answerCurrentQuestion = (correctly: boolean) =>
    cy
      .get('[data-testid="quiz-prompt"]')
      .invoke('attr', 'data-country-code')
      .then((code) => {
        const correctChoice = `[data-testid="quiz-choice-${code}"]`;
        return correctly
          ? cy.get(correctChoice).click()
          : cy
              .get('[data-testid="quiz-choices"] button')
              .not(correctChoice)
              .first()
              .click();
      });

  it('starts from the Flags card and plays a ten-question round', () => {
    cy.visit('/home');
    cy.get('[data-testid="play-flags"]').click({ scrollBehavior: 'center' });
    cy.location('search').should('eq', '?category=flags');

    cy.get('[data-testid="setup-start"]').click();

    cy.location('pathname').should('eq', '/quiz/flags');
    cy.get('[data-testid="quiz-question"]', { timeout: 20_000 }).should(
      'contain.text',
      'Which country does this flag belong to?',
    );
    // The flag is the whole question: no country name is shown.
    cy.get('[data-testid="quiz-flag"]').should('be.visible');
    cy.get('[data-testid="quiz-country"]').should('not.exist');

    for (let question = 1; question <= 10; question++) {
      cy.get('[data-testid="quiz-position"]').should(
        'contain.text',
        `Question ${question} of 10`,
      );
      answerCurrentQuestion(true);
      cy.get('[data-testid="quiz-continue"]').click();
    }

    cy.get('[data-testid="results-score"]').should(
      'contain.text',
      '10 of 10 correct',
    );
  });

  it('records a flags mistake separately from capitals', () => {
    cy.visit('/quiz/flags?scope=europe&difficulty=easy&mode=fixed&count=1');

    cy.get('[data-testid="quiz-position"]', { timeout: 20_000 }).should(
      'contain.text',
      'Question 1 of 1',
    );
    answerCurrentQuestion(false);
    cy.get('[data-testid="quiz-correct-answer"]').should('not.be.empty');
    cy.get('[data-testid="quiz-continue"]').click();
    cy.get('[data-testid="results-exit"]').click();

    cy.location('pathname').should('eq', '/home');
    cy.get('[data-testid="practice"]').should(
      'contain.text',
      '1 country to review',
    );
  });

  it('starts a fresh quiz after going home from the results', () => {
    /** Ionic keeps hidden pages in the DOM; act on the page being shown. */
    const current = (testId: string) =>
      cy
        .get(`[data-testid="${testId}"]`)
        .filter((_, element) => !element.closest('.ion-page-hidden'));

    const startFromHome = () => {
      current('play-flags').click({ scrollBehavior: 'center' });
      current('setup-start').click();
      cy.get('[data-testid="quiz-position"]', { timeout: 20_000 }).should(
        'contain.text',
        'Question 1 of 10',
      );
    };

    // Opened on another tab (a reload or a deep link): Ionic's stack then has
    // no page for /home, which is what let a finished quiz survive going home.
    cy.visit('/settings');
    cy.get('[data-testid="tab-home"]').click();
    startFromHome();
    for (let question = 1; question <= 10; question++) {
      answerCurrentQuestion(true);
      current('quiz-continue').click();
    }
    current('results-exit').click();
    cy.location('pathname').should('eq', '/home');
    // Going home ends the quiz: nothing of it stays in the navigation stack.
    cy.get('wq-quiz-page').should('not.exist');

    // Same category and options, so the same URL as the finished quiz.
    startFromHome();
    cy.get('wq-quiz-page').should('have.length', 1);
    cy.get('[data-testid="results-score"]').should('not.exist');
  });

  it('asks for the country name in Hard mode', () => {
    cy.visit('/quiz/flags?scope=world&difficulty=hard&mode=fixed&count=1');

    cy.get('[data-testid="quiz-answer-input"] input', {
      timeout: 20_000,
    }).should('have.attr', 'placeholder', 'Country name');
  });
});
