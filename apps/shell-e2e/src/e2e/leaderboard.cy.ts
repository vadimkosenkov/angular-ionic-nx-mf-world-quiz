/**
 * Leaderboard challenges against the real API: a challenge issued by the
 * server, played across the microfrontend boundary, ranked, and shown on the
 * board and in the player's records under their chosen nickname.
 */
import { API } from '../support/commands';

/** Answers every question of the running quiz correctly. */
const answerAll = (count: number) => {
  for (let question = 1; question <= count; question++) {
    cy.get('[data-testid="quiz-prompt"]')
      .invoke('attr', 'data-country-code')
      .then((code) => cy.get(`[data-testid="quiz-choice-${code}"]`).click());
    cy.get('[data-testid="quiz-continue"]').click();
  }
};

describe('leaderboard', () => {
  beforeEach(() => {
    cy.signIn();
  });

  it('plays a server-issued challenge, ranks it and shows it under the chosen nickname', () => {
    cy.visit('/settings');
    cy.get('[data-testid="nickname-edit"]').click({ scrollBehavior: 'center' });
    cy.get('[data-testid="nickname-input"] input').clear({
      scrollBehavior: 'center',
    });
    cy.get('[data-testid="nickname-input"] input').type('Speedy E2E', {
      scrollBehavior: 'center',
    });
    cy.get('[data-testid="nickname-save"]').click({ scrollBehavior: 'center' });
    cy.get('[data-testid="account-nickname"]').should(
      'contain.text',
      'Speedy E2E',
    );

    cy.get('[data-testid="tab-leaderboard"]').click();
    cy.get('[data-testid="challenge-start"]').click({
      scrollBehavior: 'center',
    });
    cy.location('pathname').should('eq', '/quiz/capitals');
    cy.location('search').should('contain', 'mode=challenge');
    cy.get('[data-testid="quiz-position"]', { timeout: 20_000 }).should(
      'contain.text',
      'Question 1 of 195',
    );

    answerAll(195);

    cy.get('[data-testid="results-score"]').should(
      'contain.text',
      '195 of 195 correct',
    );
    cy.get('[data-testid="results-rank"]', { timeout: 10_000 }).should(
      'contain.text',
      'Ranked #',
    );
    cy.get('[data-testid="results-record"]').should('be.visible');

    cy.get('[data-testid="results-play-again"]')
      .should('contain.text', 'New challenge')
      .click();
    cy.location('pathname').should('eq', '/leaderboard');
    cy.get('[data-testid="leaderboard-entries"] li[aria-current="true"]')
      .should('contain.text', 'Speedy E2E')
      .and('contain.text', '(you)');

    // Public: the same board without signing in, and no account ids in it.
    cy.request(`${API}/v1/leaderboards/capitals-easy`)
      .its('body.entries')
      .should((entries: { nickname: string }[]) => {
        expect(entries.map((entry) => entry.nickname)).to.include('Speedy E2E');
        expect(JSON.stringify(entries)).not.to.match(/userId|email/);
      });

    cy.get(
      '[data-testid="leaderboard-view"] ion-segment-button[value="mine"]',
    ).click();
    cy.get('[data-testid="record-capitals-easy"]').should('contain.text', '#');
    cy.get('[data-testid="record-flags-hard"]').should(
      'contain.text',
      'No perfect run yet',
    );
  });

  it('says so when a challenge cannot be started', () => {
    cy.intercept('POST', `${API}/v1/challenges`, { forceNetworkError: true });
    cy.visit('/leaderboard');

    cy.get('[data-testid="challenge-start"]').click({
      scrollBehavior: 'center',
    });

    cy.get('[data-testid="challenge-start-failed"]').should(
      'contain.text',
      'could not be started',
    );
    cy.location('pathname').should('eq', '/leaderboard');
  });
});
