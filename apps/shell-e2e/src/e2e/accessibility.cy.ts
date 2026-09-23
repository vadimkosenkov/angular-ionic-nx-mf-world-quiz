/**
 * Every screen a player passes through, checked with axe against WCAG 2.2
 * A and AA. The app is played by touch and by VoiceOver, and the rules
 * these checks enforce — names for controls, labels for inputs, contrast,
 * heading order — are the ones that break silently.
 */
import { expectAccessible } from '../support/accessibility';
import { answerChoice, byTestId } from '../support/quiz';

describe('accessibility', () => {
  it('checks the welcome screen, signed out', () => {
    cy.visit('/welcome');
    cy.contains('Master every capital and flag').should('be.visible');

    expectAccessible();
  });

  describe('signed in', () => {
    beforeEach(() => {
      cy.signIn();
    });

    it('checks Home', () => {
      cy.visit('/home');
      byTestId('overall-progress', { timeout: 20_000 }).should('exist');
      expectAccessible();
    });

    it('checks the quiz setup', () => {
      cy.visit('/quiz/setup?category=capitals');
      byTestId('setup-start', { timeout: 20_000 }).should('exist');
      expectAccessible();
    });

    it('checks the Leaderboard tab', () => {
      cy.visit('/leaderboard');
      byTestId('leaderboard-board', { timeout: 20_000 }).should('exist');
      expectAccessible();
    });

    it('checks the Achievements tab', () => {
      cy.visit('/achievements');
      byTestId('achievement-list', { timeout: 20_000 }).should('exist');
      expectAccessible();
    });

    it('checks Settings', () => {
      cy.visit('/settings');
      byTestId('theme-dark', { timeout: 20_000 }).should('exist');
      expectAccessible();
    });

    it('checks the quiz itself and its results, in both difficulties', () => {
      cy.visit(
        '/quiz/capitals?scope=europe&difficulty=easy&mode=fixed&count=1',
      );
      // The choices sit below the fold in Cypress's viewport; axe reads the
      // whole document, so existence is what matters here.
      byTestId('quiz-choices', { timeout: 20_000 }).should('exist');
      expectAccessible();

      answerChoice(false);
      byTestId('results-review').should('exist');
      expectAccessible();

      cy.visit('/quiz/flags?scope=europe&difficulty=hard&mode=fixed&count=1');
      byTestId('quiz-answer-input', { timeout: 20_000 }).should('exist');
      expectAccessible();
    });

    it('checks a screen in Russian and in the dark theme', () => {
      cy.visitWithScheme('/settings', 'dark');
      byTestId('language-ru').click();
      cy.get('html').should('have.attr', 'lang', 'ru');
      expectAccessible();

      cy.visit('/home');
      byTestId('overall-progress', { timeout: 20_000 }).should('exist');
      expectAccessible();
    });
  });

  // The public site is a different application on its own origin, and the
  // one people reach without an account at all. `cy.visit` moves the whole
  // test there, so no `cy.origin` is needed.
  describe('the public site', () => {
    const SITE = 'http://localhost:4300';

    for (const path of [
      '/en',
      '/en/privacy',
      '/en/leaderboard/capitals-easy',
    ]) {
      it(`checks ${path}`, () => {
        cy.visit(`${SITE}${path}`);
        cy.get('main', { timeout: 20_000 }).should('exist');
        expectAccessible();
      });
    }
  });
});
