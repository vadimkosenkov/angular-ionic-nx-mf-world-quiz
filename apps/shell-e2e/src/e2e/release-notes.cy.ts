/**
 * What changed in this release, and how the player finds out about it: the
 * bell on Home, the page it points at, and the mark that goes once the page
 * has been read (docs/architecture/frontend.md).
 */
import { RELEASE_SEEN_KEY } from '../support/commands';

/** A device that last read about a release older than any this build has. */
const behind = (window: Window) =>
  window.localStorage.setItem(RELEASE_SEEN_KEY, '0.0');

const visitHome = () => cy.visit('/home', { onBeforeLoad: behind });

describe('release notes', () => {
  beforeEach(() => {
    cy.signIn();
  });

  it('points at what changed, and stops once it has been read', () => {
    visitHome();

    cy.get('[data-testid="notifications-dot"]').should('exist');
    cy.get('[data-testid="notifications"]').click();
    cy.get('[data-testid="notification-release"]')
      .should('contain.text', 'Update')
      .click();

    cy.location('pathname').should('eq', '/release-notes');
    cy.get('[data-testid="release"]').should('have.length.at.least', 1);
    cy.get('[data-testid="release-version"]')
      .first()
      .invoke('text')
      .as('newest');

    // Reading is what clears the mark, in both places it is shown.
    cy.get('[data-testid="page-back"]').click();
    cy.location('pathname').should('eq', '/home');
    cy.get('[data-testid="notifications-dot"]').should('not.exist');

    cy.get('[data-testid="tab-settings"]').click();
    cy.get('[data-testid="whats-new"]').should('exist');
    cy.get('[data-testid="whats-new-dot"]').should('not.exist');
  });

  it('opens the list below the bell, wherever the bell was pressed', () => {
    // The mark sits in the bell's top corner. Anchored to the press rather
    // than to the button, the list opened a dozen pixels higher and covered
    // the bell — which only a real browser can show: Ionic's popover is
    // never laid out in jsdom.
    visitHome();
    cy.get('[data-testid="notifications-dot"]').should('exist');
    // Pressed where the mark is, in the button's own coordinates: the mark
    // itself takes no presses, so this is what a finger on it really does.
    // (A forced click on the mark would be dispatched to the mark, which no
    // press can be.)
    cy.get('[data-testid="notifications"]').click(30, 14);

    cy.get('[data-testid="notification-release"]').should('be.visible');
    cy.get('[data-testid="notifications"]').then((bell) => {
      const button = bell.get(0).getBoundingClientRect();
      cy.get('ion-popover')
        .shadow()
        .find('.popover-content')
        .then((content) => {
          expect(content.get(0).getBoundingClientRect().top).to.be.at.least(
            button.bottom,
          );
        });
    });
  });

  it('stays read after a reload, and the bell still answers', () => {
    visitHome();
    cy.get('[data-testid="notifications"]').click();
    cy.get('[data-testid="notification-release"]').click();
    cy.location('pathname').should('eq', '/release-notes');

    cy.visit('/home');
    cy.get('[data-testid="notifications-dot"]').should('not.exist');
    // The bell is a control the player can learn, so it does not disappear
    // when there is nothing in it; it says so.
    cy.get('[data-testid="notifications"]').click();
    cy.get('[data-testid="notifications-empty"]').should('exist');
    cy.get('[data-testid="notification-release"]').should('not.exist');
  });

  it('is reached from Settings as well', () => {
    cy.visit('/settings', { onBeforeLoad: behind });

    cy.get('[data-testid="whats-new-dot"]').should('exist');
    cy.get('[data-testid="whats-new"]').click();

    cy.location('pathname').should('eq', '/release-notes');
    cy.get('[data-testid="release"]').first().should('contain.text', 'Version');
    // Back goes where the player came from, not to a fixed address.
    cy.get('[data-testid="page-back"]').click();
    cy.location('pathname').should('eq', '/settings');
    cy.get('[data-testid="whats-new-dot"]').should('not.exist');
  });
});
