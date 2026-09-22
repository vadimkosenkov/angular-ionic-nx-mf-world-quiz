/**
 * The Capitals journey across the microfrontend boundary: the shell renders
 * the setup screen, the quiz itself comes from the `capitals` remote loaded
 * at runtime, and the finished session is recorded by the shell.
 */
describe('capitals quiz', () => {
  // Playing needs an account: every test starts as a new signed-in player.
  beforeEach(() => {
    cy.signIn();
  });

  /**
   * Answers the visible question. The prompt carries the country code, so the
   * test can pick the matching choice without knowing the dataset.
   */
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

  it('plays a ten-question Easy round and shows the result', () => {
    cy.visit('/home');
    // The header is translucent: scrolling the button to the top of the
    // viewport would put it under the toolbar, so click it in the middle.
    cy.get('[data-testid="play-capitals"]').click({ scrollBehavior: 'center' });
    cy.location('pathname').should('eq', '/quiz/setup');

    cy.get('[data-testid="setup-start"]').click();

    cy.location('pathname').should('eq', '/quiz/capitals');
    cy.location('search').should('contain', 'mode=fixed');
    // The remote is fetched here: its chunk is not part of the shell bundle.
    cy.get('[data-testid="quiz-position"]', { timeout: 20_000 }).should(
      'contain.text',
      'Question 1 of 10',
    );

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
    cy.get('[data-testid="results-accuracy"]').should('contain.text', '100%');
    cy.get('[data-testid="results-hero"]').should(
      'contain.text',
      'Perfect run!',
    );
  });

  it('records progress in the shell and offers the mistakes for practice', () => {
    cy.visit('/quiz/capitals?scope=europe&difficulty=easy&mode=fixed&count=1');

    cy.get('[data-testid="quiz-position"]', { timeout: 20_000 }).should(
      'contain.text',
      'Question 1 of 1',
    );
    answerCurrentQuestion(false);
    cy.get('[data-testid="quiz-continue"]').click();

    cy.get('[data-testid="results-review"]').should('be.visible');
    cy.get('[data-testid="results-exit"]').click();

    cy.location('pathname').should('eq', '/home');
    cy.get('[data-testid="practice"]').should(
      'contain.text',
      '1 country to review',
    );
  });

  it('focuses the answer field in Hard mode, for every question', () => {
    cy.visit('/quiz/capitals?scope=europe&difficulty=hard&mode=fixed&count=2');

    cy.get('[data-testid="quiz-answer-input"] input', {
      timeout: 20_000,
    }).should('have.focus');
    cy.focused().type('not a capital{enter}');
    cy.get('[data-testid="quiz-feedback"]').should('contain.text', 'Not quite');
    cy.get('[data-testid="quiz-continue"]').click();

    cy.get('[data-testid="quiz-position"]').should(
      'contain.text',
      'Question 2 of 2',
    );
    cy.get('[data-testid="quiz-answer-input"] input').should('have.focus');
  });

  it('leaves the quiz through the exit button', () => {
    cy.visit('/quiz/capitals?scope=world&difficulty=easy&mode=fixed&count=10');

    cy.get('[data-testid="quiz-exit"]', { timeout: 20_000 }).click();

    cy.location('pathname').should('eq', '/home');
  });
});
