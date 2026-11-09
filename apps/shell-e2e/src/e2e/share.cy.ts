/**
 * Sharing a finished run and a personal record: the app builds the message
 * in the player's language and hands it to the device, which is the part a
 * unit test cannot show — the real screens, the real translations and the
 * address this deployment is served from.
 */
import { answerChoice, byTestId, recordShares } from '../support/quiz';

describe('sharing', () => {
  beforeEach(() => {
    cy.signIn();
  });

  it('hands a finished run to the system share sheet', () => {
    cy.visit('/quiz/capitals?scope=europe&difficulty=easy&mode=fixed&count=1', {
      onBeforeLoad: recordShares,
    });

    answerChoice(true);
    byTestId('results-share').click();

    cy.window().its('sharedPayloads').should('have.length', 1);
    cy.window()
      .its('sharedPayloads.0.text')
      .should('contain', 'World Quiz — Capitals, Europe')
      .and('contain', '1/1 correct · 100%');
    // The link is where this deployment is served from, so whoever receives
    // the message can play the same quiz.
    cy.window().then((win) => {
      cy.window().its('sharedPayloads.0.url').should('eq', win.location.origin);
    });
  });

  it('shares a record in Russian when the app is in Russian', () => {
    cy.visit('/settings');
    byTestId('language-ru').click({ scrollBehavior: 'center' });

    cy.visit('/quiz/capitals?scope=europe&difficulty=easy&mode=fixed&count=1', {
      onBeforeLoad: recordShares,
    });
    answerChoice(true);
    byTestId('results-share').click();

    cy.window().its('sharedPayloads.0.text').should('contain', '1/1 верно');
  });
});
