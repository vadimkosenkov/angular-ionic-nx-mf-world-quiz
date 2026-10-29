/**
 * The guided tour of the quiz setup: shown once, one step per choice, and
 * switched off and on again from Settings
 * (docs/architecture/design-system.md).
 */
import { expectAccessible } from '../support/accessibility';

const tour = () => cy.get('[data-testid="tour-step"]');
const next = () => cy.get('[data-testid="tour-next"]');
const section = (step: string) => cy.get(`[data-tour="${step}"]`);
const toggle = () => cy.get('[data-testid="tips-toggle"]');

describe('first-run hints', () => {
  beforeEach(() => {
    // The rest of the suite skips the hints; this spec is about them.
    cy.showHints();
    cy.signIn();
  });

  it('walks the four choices before the quiz can start', () => {
    cy.visit('/quiz/setup?category=capitals');

    tour().should('contain.text', 'Start with the quiz type');
    // Everything the step is not about waits, out of reach of taps and of
    // the screen reader.
    section('category').should('not.have.class', 'wq-tour-aside');
    section('scope').should('have.attr', 'inert');
    cy.get('[data-testid="setup-start"]').should('not.exist');
    expectAccessible();

    next().click();
    tour().should('contain.text', 'Now the region');
    section('scope').should('not.have.attr', 'inert');

    next().click();
    next().click();
    tour().should('contain.text', 'the game mode');

    next().click();
    tour().should('not.exist');
    cy.get('[data-tour="scope"]').should('not.have.attr', 'inert');
    cy.get('[data-testid="setup-start"]').should('be.visible');
  });

  it('stays away once it has been through, and the quiz starts right away', () => {
    cy.visit('/quiz/setup?category=capitals');
    for (let step = 0; step < 4; step++) next().click();

    // The device remembers, so a new round does not start with the tour.
    cy.visit('/quiz/setup?category=flags');
    cy.get('[data-testid="setup-start"]', { timeout: 20_000 }).should(
      'be.visible',
    );
    tour().should('not.exist');
  });

  it('switches itself off in Settings, and comes back when switched on', () => {
    cy.visit('/quiz/setup?category=capitals');
    for (let step = 0; step < 4; step++) next().click();

    // Nothing is going to appear any more, and the switch says so.
    cy.visit('/settings');
    toggle().should('have.prop', 'checked', false);
    toggle().click({ scrollBehavior: 'center' });

    cy.visit('/quiz/setup?category=capitals');
    tour().should('contain.text', 'Start with the quiz type');
  });

  it('shows no tour at all once it is switched off', () => {
    cy.visit('/settings');
    toggle().should('have.prop', 'checked', true);
    toggle().click({ scrollBehavior: 'center' });

    cy.visit('/quiz/setup?category=capitals');
    cy.get('[data-testid="setup-start"]', { timeout: 20_000 }).should(
      'be.visible',
    );
    tour().should('not.exist');
  });
});
