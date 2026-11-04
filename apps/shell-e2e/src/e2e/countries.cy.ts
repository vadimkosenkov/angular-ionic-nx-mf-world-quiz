/**
 * The countries reference: what the player reads instead of guessing.
 *
 * The unit tests already cover which rows are built and when a fact lights
 * up. What only a browser can say is that the flag files really are where
 * the dataset says they are, and that the region filter rebuilds the list.
 */
import { byTestId } from '../support/quiz';

const OCEANIA = 14;

describe('countries reference', () => {
  beforeEach(() => {
    cy.signIn();
  });

  it('opens from Home and lists every country with its capital and flag', () => {
    cy.visit('/home');
    byTestId('learn-countries', { timeout: 20_000 }).click({
      scrollBehavior: 'center',
    });
    cy.location('pathname').should('eq', '/countries');

    byTestId('country-list', { timeout: 20_000 })
      .find('li')
      .should('have.length', 195);

    byTestId('country-fr')
      .should('contain.text', 'France')
      .and('contain.text', 'Paris');

    // A flag that failed to load still has its <img>, so the test asks the
    // browser whether a picture actually arrived. It asks the first row:
    // the flags below the fold are loaded lazily and have no picture yet,
    // which is the point of loading them that way.
    byTestId('country-list')
      .find('li')
      .first()
      .find('img')
      .should((found) => {
        const flag = found[0] as HTMLImageElement;
        expect(
          flag.naturalWidth,
          `flag at ${flag.getAttribute('src')}`,
        ).to.be.greaterThan(0);
      });
  });

  it('filters by region', () => {
    cy.visit('/countries');
    byTestId('country-list', { timeout: 20_000 }).should('exist');

    byTestId('countries-scope-oceania').click();

    byTestId('country-list').find('li').should('have.length', OCEANIA);
    byTestId('country-au').should('exist');
    byTestId('country-fr').should('not.exist');
  });

  it('says in words what the green highlight says in colour', () => {
    cy.visit('/countries');
    byTestId('country-list', { timeout: 20_000 }).should('exist');

    // Nothing is mastered on a freshly signed-in device, so both facts are
    // plain — and each one still names its own state for a screen reader.
    byTestId('mark-capitals-fr')
      .should('not.have.class', 'mastered')
      .and('contain.text', 'Capital: not mastered yet');
    byTestId('mark-flags-fr').should('not.have.class', 'mastered');
    byTestId('country-fr').should('contain.text', 'Flag: not mastered yet');
  });
});
