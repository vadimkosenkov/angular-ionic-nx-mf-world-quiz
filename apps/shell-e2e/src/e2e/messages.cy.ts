/**
 * The app's one way of saying that something just went well or wrong
 * (docs/architecture/design-system.md). The account actions in Settings are
 * where every kind of message happens: a confirmation, a failure, and one
 * said about a screen the app immediately leaves.
 */
import { expectAccessible } from '../support/accessibility';
import { API } from '../support/commands';

const toast = () => cy.get('[data-testid="toast"]');

const saveNickname = (name: string) => {
  cy.get('[data-testid="nickname-edit"]').click({ scrollBehavior: 'center' });
  cy.get('[data-testid="nickname-input"] input').clear({
    scrollBehavior: 'center',
  });
  cy.get('[data-testid="nickname-input"] input').type(name, {
    scrollBehavior: 'center',
  });
  cy.get('[data-testid="nickname-save"]').click({ scrollBehavior: 'center' });
};

describe('messages', () => {
  beforeEach(() => {
    cy.signIn();
  });

  it('confirms what worked, politely, and takes itself away', () => {
    cy.visit('/settings');
    saveNickname('Globe Trotter');

    toast()
      .should('have.attr', 'role', 'status')
      .and('contain.text', 'Your public name is saved.');
    expectAccessible();

    // A message, not a state: nobody has to dismiss it.
    cy.get('[data-testid="toast"]', { timeout: 8000 }).should('not.exist');
    cy.get('[data-testid="account-nickname"]').should(
      'contain.text',
      'Globe Trotter',
    );
  });

  it('interrupts with a failure, which the player can put away at once', () => {
    cy.visit('/settings');
    cy.intercept('PATCH', `${API}/v1/me`, { forceNetworkError: true });
    saveNickname('Globe Trotter');

    toast()
      .should('have.attr', 'role', 'alert')
      .and('contain.text', 'cannot be reached');
    // The form stays open, with the name the player typed.
    cy.get('[data-testid="nickname-input"] input').should(
      'have.value',
      'Globe Trotter',
    );

    cy.get('[data-testid="toast-dismiss"]').click();
    toast().should('not.exist');
  });

  it('answers a retry that fails again, which changes nothing on screen', () => {
    // The API is unreachable from the first check onwards, so the app cannot
    // verify the sign-in and offers "Try again".
    cy.intercept('POST', `${API}/v1/auth/refresh`, { forceNetworkError: true });
    cy.visit('/settings');

    cy.get('[data-testid="retry-restore"]').click({ scrollBehavior: 'center' });

    toast()
      .should('have.attr', 'role', 'alert')
      .and('contain.text', 'cannot be reached');
  });

  it('is still there after the screen it was said on has gone', () => {
    cy.visit('/settings');
    cy.get('[data-testid="sign-out"]').click({ scrollBehavior: 'center' });

    cy.location('pathname').should('eq', '/welcome');
    toast().should('contain.text', 'You are signed out.');
  });
});
