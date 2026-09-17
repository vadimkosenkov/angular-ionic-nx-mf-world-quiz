const html = () => cy.get('html');

describe('settings', () => {
  it('follows the system appearance by default', () => {
    cy.visitWithScheme('/settings', 'dark');
    html().should('have.class', 'ion-palette-dark');

    cy.visitWithScheme('/settings', 'light');
    html().should('not.have.class', 'ion-palette-dark');
  });

  it('keeps an explicit theme choice after a reload, regardless of the system', () => {
    cy.visitWithScheme('/settings', 'light');
    cy.get('[data-testid="theme-dark"]').click();
    html()
      .should('have.class', 'ion-palette-dark')
      .and('have.css', 'color-scheme', 'dark');

    cy.visitWithScheme('/settings', 'light');
    html().should('have.class', 'ion-palette-dark');

    cy.get('[data-testid="theme-light"]').click();
    html().should('not.have.class', 'ion-palette-dark');
  });

  it('switches the whole UI to Russian and remembers it', () => {
    cy.visit('/settings');
    cy.get('[data-testid="language-ru"]').click();

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

  it('shows bundled flag images for the languages', () => {
    cy.visit('/settings');
    cy.get('[data-testid="language-ru"] img.flag')
      .should('have.attr', 'src', 'flags/ru.svg')
      .and(($img) => {
        expect(($img[0] as HTMLImageElement).naturalWidth).to.be.greaterThan(0);
      });
  });
});
