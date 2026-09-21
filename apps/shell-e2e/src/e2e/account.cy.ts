/**
 * Sign-in against the real API (started with a fresh database and the
 * development sign-in). Google itself is not automated: the dev sign-in
 * creates the same session a verified Google token would, so this covers
 * everything after the provider — cookie, restore on reload, sign-out and
 * account deletion.
 */
const API = 'http://localhost:3333';

/** Signs in through the API; the browser keeps the httpOnly refresh cookie. */
const devSignIn = (subject: string, displayName: string) =>
  cy.request('POST', `${API}/v1/auth/dev`, { subject, displayName });

describe('account', () => {
  beforeEach(() => {
    cy.clearAllCookies();
  });

  it('offers sign-in when signed out', () => {
    cy.visit('/settings');

    cy.get('[data-testid="account"]').should(
      'contain.text',
      'Sign in to create',
    );
    cy.get('[data-testid="apple-unavailable"]').should(
      'contain.text',
      'Sign in with Apple arrives with the iPhone app.',
    );
  });

  it('stays signed in across reloads and signs out', () => {
    devSignIn('e2e-ann', 'E2E Ann');
    cy.visit('/settings');

    cy.get('[data-testid="account-name"]').should('contain.text', 'E2E Ann');
    cy.window().then((window) => {
      // The app never keeps tokens where scripts could read them later.
      expect(window.localStorage.length).to.equal(0);
      expect(window.document.cookie).not.to.contain('wq_refresh');
    });

    cy.reload();
    cy.get('[data-testid="account-name"]').should('contain.text', 'E2E Ann');

    cy.get('[data-testid="sign-out"]').click({ scrollBehavior: 'center' });
    cy.get('[data-testid="apple-unavailable"]').should('be.visible');
    cy.reload();
    cy.get('[data-testid="apple-unavailable"]').should('be.visible');
  });

  it('deletes the account after confirmation', () => {
    devSignIn('e2e-leaving', 'E2E Leaving').then((signIn) => {
      const deletedUserId = signIn.body.user.id as string;
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

      cy.get('[data-testid="apple-unavailable"]').should('be.visible');
      // Gone on the server too: the same provider account now gets a new user.
      devSignIn('e2e-leaving', 'E2E Leaving')
        .its('body.user.id')
        .should('not.equal', deletedUserId);
    });
  });
});
