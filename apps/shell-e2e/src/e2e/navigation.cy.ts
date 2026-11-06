describe('main navigation', () => {
  // Playing needs an account: every test starts as a new signed-in player.
  beforeEach(() => {
    cy.signIn();
  });

  it('opens on Home with real dataset totals', () => {
    cy.visit('/');

    cy.title().should('eq', 'World Quiz');
    cy.location('pathname').should('eq', '/home');
    cy.get('[data-testid="greeting"]').should('be.visible');
    cy.get('[data-testid="play-setup"]').should(
      'contain.text',
      'Capitals · World · Easy · Quick round',
    );
    cy.get('[data-testid="overall-progress"] [role="progressbar"]').should(
      'have.attr',
      'aria-valuetext',
      '0 of 390',
    );
  });

  it('switches between the four tabs', () => {
    cy.visit('/home');

    const tabs = [
      ['leaderboard', 'The fastest perfect run wins'],
      ['achievements', '0/14 unlocked'],
      ['settings', 'Appearance'],
      ['home', 'Capitals · World · Easy · Quick round'],
    ] as const;

    for (const [tab, text] of tabs) {
      cy.get(`[data-testid="tab-${tab}"]`).click();
      cy.location('pathname').should('eq', `/${tab}`);
      cy.get('ion-router-outlet .ion-page:not(.ion-page-hidden)').should(
        'contain.text',
        text,
      );
    }
  });

  it('opens deep links directly and redirects unknown paths home', () => {
    cy.visit('/achievements');
    cy.get('[data-testid="achievement-list"] li').should('have.length', 14);

    cy.visit('/does-not-exist');
    cy.location('pathname').should('eq', '/home');
  });
});
