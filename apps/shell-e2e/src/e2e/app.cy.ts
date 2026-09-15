/**
 * Foundation smoke test: proves the Cypress pipeline (build → static server →
 * browser → assertion) works locally and in CI. It intentionally does NOT
 * claim to test product behaviour; real user journeys are added per feature.
 */
describe('shell smoke test', () => {
  it('serves the shell application', () => {
    cy.visit('/');

    cy.title().should('eq', 'World Quiz');
    cy.get('h1').should('have.text', 'World Quiz');
  });
});
