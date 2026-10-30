const html = () => cy.get('html');

describe('settings', () => {
  // Playing needs an account: every test starts as a new signed-in player.
  beforeEach(() => {
    cy.signIn();
  });

  it('follows the system appearance by default', () => {
    cy.visitWithScheme('/settings', 'dark');
    html().should('have.class', 'ion-palette-dark');

    cy.visitWithScheme('/settings', 'light');
    html().should('not.have.class', 'ion-palette-dark');
  });

  it('keeps an explicit theme choice after a reload, regardless of the system', () => {
    cy.visitWithScheme('/settings', 'light');
    cy.get('[data-testid="theme-dark"]').click({ scrollBehavior: 'center' });
    html()
      .should('have.class', 'ion-palette-dark')
      .and('have.css', 'color-scheme', 'dark');

    cy.visitWithScheme('/settings', 'light');
    html().should('have.class', 'ion-palette-dark');

    cy.get('[data-testid="theme-light"]').click({ scrollBehavior: 'center' });
    html().should('not.have.class', 'ion-palette-dark');
  });

  it('switches the whole UI to Russian and remembers it', () => {
    cy.visit('/settings');
    cy.get('[data-testid="language-ru"]').click({ scrollBehavior: 'center' });

    html().should('have.attr', 'lang', 'ru');
    cy.get('[data-testid="tab-home"]').should('contain.text', 'Главная');
    cy.get('#appearance-title').should('contain.text', 'Оформление');

    cy.reload();
    html().should('have.attr', 'lang', 'ru');
    cy.get('[data-testid="tab-settings"]').should('contain.text', 'Настройки');

    cy.get('[data-testid="tab-home"]').click();
    cy.get('[data-testid="category-capitals"]').should(
      'contain.text',
      '195 стран · 6 регионов',
    );
  });

  it('explains a setting where the setting is, and puts it away again', () => {
    cy.visit('/settings');
    cy.get('[data-testid="sound-info"] button').click({
      scrollBehavior: 'center',
    });

    cy.get('[data-testid="info-note"]').should(
      'contain.text',
      'Short tones when an answer lands',
    );
    // The backdrop lives in the popover's shadow root, out of reach of a
    // test; Escape is the other way out.
    cy.get('body').type('{esc}');
    cy.get('[data-testid="info-note"]').should('not.exist');
  });

  it('shows bundled flag images for the languages', () => {
    cy.visit('/settings');
    cy.get('[data-testid="language-ru"] img.flag')
      .should('have.attr', 'src', 'flags/ru.svg')
      .and(($img) => {
        expect(($img[0] as HTMLImageElement).naturalWidth).to.be.greaterThan(0);
      });
  });
});
