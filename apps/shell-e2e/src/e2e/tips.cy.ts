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

/** The section a step is about, as the page has laid it out. */
const sectionRect = (document: Document, step: string) =>
  (
    document.querySelector(`[data-tour="${step}"]`) as HTMLElement
  ).getBoundingClientRect();

/**
 * Checks that the lit window of the dimming layer sits on the section this
 * step is about.
 *
 * The clip path is the screen, then the window; the window's first point is
 * on its top edge. A browser writes the path back in its own way — Chrome
 * separates `M 32 68` with spaces where the source has commas — so the
 * separator is read as either. Both the window and the section are read
 * inside the assertion, so it settles once the tour has arrived rather than
 * racing it.
 */
const lightFallsOn = (step: string) =>
  cy.get('wq-tour-spotlight').should((found) => {
    const layer = found[0] as HTMLElement;
    const window = /M\s*[\d.]+[\s,]+[\d.]+[^M]*M\s*[\d.]+[\s,]+([\d.]+)/.exec(
      layer.style.clipPath,
    );
    expect(window, 'the layer has a window in it').to.not.equal(null);
    expect(Number(window?.[1])).to.be.closeTo(
      sectionRect(layer.ownerDocument, step).top - 12,
      3,
    );
  });

/**
 * Checks that the step's card is shown, and stands next to that section
 * rather than anywhere else. A card still fading in has not been placed
 * yet, so the assertion is retried until it has.
 */
const cardStandsBy = (step: string) =>
  cy.get('[data-testid="tour-step"]').should((found) => {
    const element = found[0] as HTMLElement;
    expect(element.classList.contains('placed'), 'the card is shown').to.equal(
      true,
    );
    const card = element.getBoundingClientRect();
    const section = sectionRect(element.ownerDocument, step);
    const gap =
      card.top >= section.bottom
        ? card.top - section.bottom
        : section.top - card.bottom;
    expect(gap, 'the card stands next to the section').to.be.within(0, 60);
  });

describe('first-run hints', () => {
  beforeEach(() => {
    // The rest of the suite skips the hints; this spec is about them.
    cy.showHints();
    cy.signIn();
  });

  it('walks the four choices before the quiz can start', () => {
    cy.visit('/quiz/setup?category=capitals');

    tour().should('contain.text', 'Start with the quiz type');
    // Everything the step is not about waits, dimmed and out of reach of
    // taps and of the screen reader.
    lightFallsOn('category');
    cardStandsBy('category');
    section('scope').should('have.attr', 'inert');
    cy.get('[data-testid="setup-start"]').should('not.exist');
    expectAccessible();

    next().click();
    tour().should('contain.text', 'Now the region');
    section('scope').should('not.have.attr', 'inert');
    // Neither the window nor the card travels: they wait, out of sight,
    // while the page scrolls, and appear on the step's own section.
    lightFallsOn('scope');
    cardStandsBy('scope');

    next().click();
    next().click();
    tour().should('contain.text', 'the game mode');

    next().click();
    tour().should('not.exist');
    cy.get('wq-tour-spotlight').should('not.exist');
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
