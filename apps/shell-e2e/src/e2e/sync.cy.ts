/**
 * Progress on the device and in the account: the outbox, sync with the real
 * API, and the device's data following the account (ADR-006).
 */
import { API } from '../support/commands';

/** One Easy question, answered wrongly: a mistake to find again later. */
const playOneMistake = () => {
  cy.visit('/quiz/capitals?scope=europe&difficulty=easy&mode=fixed&count=1');
  cy.get('[data-testid="quiz-prompt"]', { timeout: 20_000 })
    .invoke('attr', 'data-country-code')
    .then((code) =>
      cy
        .get('[data-testid="quiz-choices"] button')
        .not(`[data-testid="quiz-choice-${code}"]`)
        .first()
        .click(),
    );
  cy.get('[data-testid="quiz-continue"]').click();
  cy.get('[data-testid="results-exit"]').click();
  cy.location('pathname').should('eq', '/home');
};

const mistakes = () => cy.get('[data-testid="practice"]');

describe('sync', () => {
  it('saves a finished quiz to the account; it comes back after signing out and in', () => {
    const subject = `e2e-${crypto.randomUUID()}`;
    cy.signIn(subject).then(({ authorization }) => {
      playOneMistake();
      mistakes().should('contain.text', '1 country to review');

      cy.visit('/settings');
      cy.get('[data-testid="sync-status"]').should(
        'contain.text',
        'All your results are saved to your account.',
      );
      // History lists a session only once its 5-second settle window has
      // passed (HISTORY_SETTLE_MS on the API): a real rule, not a guess.
      // eslint-disable-next-line cypress/no-unnecessary-waiting
      cy.wait(5_000);
      cy.request({
        url: `${API}/v1/sessions`,
        headers: { Authorization: authorization },
      })
        .its('body.sessions')
        .should('have.length', 1);

      cy.get('[data-testid="sign-out"]').click({ scrollBehavior: 'center' });
      cy.location('pathname').should('eq', '/welcome');

      // A new sign-in on this (now empty) device pulls the history back.
      cy.signIn(subject);
      cy.visit('/home');
      mistakes().should('contain.text', '1 country to review');
    });
  });

  it('keeps results played offline, across a reload, and sends them when back online', () => {
    let online = false;
    cy.intercept('POST', `${API}/v1/sessions`, (request) => {
      if (!online) request.destroy();
    });
    cy.signIn();

    playOneMistake();
    cy.reload();
    mistakes().should('contain.text', '1 country to review');

    cy.visit('/settings');
    cy.get('[data-testid="sync-status"]').should(
      'contain.text',
      '1 result is waiting to be saved to your account.',
    );

    // Signing out now would lose it: the player is asked first.
    cy.get('[data-testid="sign-out"]').click({ scrollBehavior: 'center' });
    cy.get('[data-testid="sign-out-confirmation"]').should(
      'contain.text',
      'has not been saved to your account yet',
    );
    cy.get('[data-testid="cancel-sign-out"]').click({
      scrollBehavior: 'center',
    });

    cy.then(() => {
      online = true;
    });
    cy.window().trigger('online');
    cy.get('[data-testid="sync-status"]').should(
      'contain.text',
      'All your results are saved to your account.',
    );
  });

  it("does not show another player's results on a shared device", () => {
    cy.signIn();
    playOneMistake();

    cy.signIn();
    cy.visit('/home');
    mistakes().should('contain.text', 'All clear');
  });
});
