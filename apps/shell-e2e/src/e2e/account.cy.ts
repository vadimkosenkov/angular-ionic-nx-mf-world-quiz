/**
 * Sign-in against the real API (started with a fresh database and the
 * development sign-in). Google itself is not automated: the dev sign-in
 * creates the same session a verified Google token would, so this covers
 * everything after the provider — the welcome screen, cookie, restore on
 * reload, sign-out and account deletion.
 */
import { API } from '../support/commands';

describe('account', () => {
  it('opens on the welcome screen until the player signs in', () => {
    cy.visit('/home');

    cy.location('pathname').should('eq', '/welcome');
    cy.get('[data-testid="welcome-stats"]').should('contain.text', '195');
    cy.get('[data-testid="apple-unavailable"]').should(
      'contain.text',
      'Sign in with Apple arrives with the iPhone app.',
    );
    cy.visit('/quiz/capitals?scope=europe&difficulty=easy&mode=fixed&count=1');
    cy.location('pathname').should('eq', '/welcome');
  });

  it('stays signed in across reloads and signs out to the welcome screen', () => {
    cy.signIn(undefined, 'E2E Ann');
    cy.visit('/welcome');

    cy.location('pathname').should('eq', '/home');
    cy.get('[data-testid="tab-settings"]').click();
    cy.get('[data-testid="account-name"]').should('contain.text', 'E2E Ann');
    cy.window().then((window) => {
      // The app never keeps tokens where scripts could read them later.
      expect(window.localStorage.length).to.equal(0);
      expect(window.document.cookie).not.to.contain('wq_refresh');
    });

    cy.reload();
    cy.get('[data-testid="account-name"]').should('contain.text', 'E2E Ann');

    cy.get('[data-testid="sign-out"]').click({ scrollBehavior: 'center' });
    cy.location('pathname').should('eq', '/welcome');
    cy.reload();
    cy.location('pathname').should('eq', '/welcome');
  });

  it('deletes the account after confirmation', () => {
    cy.signIn('e2e-leaving', 'E2E Leaving').then(({ userId }) => {
      cy.visit('/settings');
      cy.get('[data-testid="account-name"]').should(
        'contain.text',
        'E2E Leaving',
      );

      cy.get('[data-testid="delete-account"]').click({
        scrollBehavior: 'center',
      });
      cy.get('[role="alertdialog"]').should(
        'contain.text',
        'deleted permanently',
      );
      cy.get('[data-testid="confirm-delete"]').click({
        scrollBehavior: 'center',
      });

      cy.location('pathname').should('eq', '/welcome');
      // Gone on the server too: the same provider account now gets a new user.
      cy.request('POST', `${API}/v1/auth/dev`, { subject: 'e2e-leaving' })
        .its('body.user.id')
        .should('not.equal', userId);
    });
  });
});
