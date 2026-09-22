/**
 * The public site (`apps/site`, :4300): what its server sends. Requests
 * without a browser show exactly what search engines and visitors without
 * JavaScript get — server-rendered or prerendered HTML.
 */
const SITE = 'http://localhost:4300';

describe('site', () => {
  it("opens in the visitor's language", () => {
    cy.request({
      url: `${SITE}/`,
      headers: { 'Accept-Language': 'ru-RU,ru;q=0.9,en;q=0.8' },
      followRedirect: false,
    }).then((response) => {
      expect(response.status).to.equal(302);
      expect(response.headers['location']).to.equal('/ru');
    });
    cy.request({
      url: `${SITE}/`,
      headers: { 'Accept-Language': 'de-DE,de;q=0.9' },
      followRedirect: false,
    })
      .its('headers.location')
      .should('equal', '/en');
  });

  it('serves prerendered legal pages in both languages, honest about the missing contact', () => {
    cy.request(`${SITE}/en/privacy`).then(({ body }) => {
      expect(body).to.match(/<html[^>]*lang="en"/);
      expect(body).to.contain('Privacy Policy');
      expect(body).to.contain('Draft: this service is not public yet.');
      expect(body).to.contain('hreflang="ru"');
    });
    cy.request(`${SITE}/ru/terms`)
      .its('body')
      .should('contain', 'Условия использования');
  });

  it('renders the leaderboard on the server, and answers 404 for an unknown board', () => {
    cy.request(`${SITE}/en/leaderboard/flags-hard`).then((response) => {
      expect(response.headers['cache-control']).to.equal('public, max-age=30');
      expect(response.body).to.contain('Flags · Hard');
      expect(response.body).to.match(
        /data-testid="site-ranking-(empty|unavailable)"|<table/,
      );
    });
    cy.request({
      url: `${SITE}/en/leaderboard/flags-timed`,
      failOnStatusCode: false,
    })
      .its('status')
      .should('equal', 404);
  });
});
