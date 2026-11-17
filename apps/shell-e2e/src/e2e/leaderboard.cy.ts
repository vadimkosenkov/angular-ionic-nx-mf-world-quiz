/**
 * The public boards against the real API. A board is the four settings a
 * quiz is played with, and nothing is started from the Leaderboard tab: an
 * ordinary quick round, played without a mistake, reaches the board of its
 * own settings and is shown under the player's chosen nickname — in the app,
 * on the public API and on the server-rendered site. A run with one wrong
 * answer reaches nothing.
 */
import { API } from '../support/commands';
import {
  advanceQuizTime,
  answerChoice,
  answerRankedRound,
  byTestId,
  controlQuizTime,
} from '../support/quiz';

/** The board a quick round over the whole world on Easy competes on. */
const BOARD = 'capitals-easy-world-fixed';
/** A quick round is ten questions. */
const ROUND = 10;
/** The quiz that board is for, opened directly: nothing starts it from here. */
const QUIZ = '/quiz/capitals?scope=world&difficulty=easy&mode=fixed';

/** Opens the board the four choices on the page describe. */
const showBoard = () => {
  byTestId('board-show', { timeout: 20_000 }).click({
    scrollBehavior: 'center',
  });
  byTestId('leaderboard-ranking', { timeout: 20_000 }).should('exist');
};

describe('leaderboard', () => {
  beforeEach(() => {
    cy.signIn();
  });

  it('ranks a flawless quick round and shows it under the chosen nickname', () => {
    cy.visit('/settings');
    byTestId('nickname-edit').click({ scrollBehavior: 'center' });
    cy.get('[data-testid="nickname-input"] input').clear();
    cy.get('[data-testid="nickname-input"] input').type('Speedy E2E');
    byTestId('nickname-save').click();
    byTestId('account-nickname').should('contain.text', 'Speedy E2E');

    // An ordinary game, played the ordinary way. The quiz's clock is under
    // the test's control so the recorded run takes as long as a person's:
    // a Cypress-speed round is refused as implausible.
    cy.visit(QUIZ, { onBeforeLoad: controlQuizTime });
    byTestId('quiz-position', { timeout: 20_000 }).should(
      'contain.text',
      `Question 1 of ${ROUND}`,
    );
    answerRankedRound(ROUND);

    byTestId('results-score').should('contain.text', `${ROUND} of ${ROUND}`);
    // The API grades the run and answers with the place it earned.
    byTestId('results-rank', { timeout: 20_000 }).should('contain.text', '#');
    byTestId('results-record').should('be.visible');

    byTestId('results-exit').click();
    cy.get('[data-testid="tab-leaderboard"]').click();
    showBoard();
    cy.get('[data-testid="leaderboard-entries"] li[aria-current="true"]')
      .should('contain.text', 'Speedy E2E')
      .and('contain.text', '(you)');

    // Public: the same board without signing in, and no account ids in it.
    cy.request(`${API}/v1/leaderboards/${BOARD}`)
      .its('body.entries')
      .should((entries: { nickname: string }[]) => {
        expect(entries.map((entry) => entry.nickname)).to.include('Speedy E2E');
        expect(JSON.stringify(entries)).not.to.match(/userId|email/);
      });
    // …and on the public site, rendered on its server.
    cy.request(`http://localhost:4300/en/leaderboard/${BOARD}`)
      .its('body')
      .should('contain', 'Speedy E2E');

    byTestId('dialog-close').click();
    cy.get(
      '[data-testid="leaderboard-view"] ion-segment-button[value="mine"]',
    ).click();
    byTestId(`record-${BOARD}`).should('contain.text', '#');
    // A board the player has never ranked on is not a row at all.
    cy.get('[data-testid="record-flags-hard-europe-timed"]').should(
      'not.exist',
    );
  });

  it('ranks nothing when one answer was wrong', () => {
    cy.visit(QUIZ, { onBeforeLoad: controlQuizTime });
    advanceQuizTime(500);
    answerChoice(false);
    answerRankedRound(ROUND - 1);

    byTestId('results-score').should(
      'contain.text',
      `${ROUND - 1} of ${ROUND}`,
    );
    // Nothing is said about a board a run could never reach.
    cy.get('[data-testid="results-board"]').should('not.exist');

    // The board the run would have competed on stays empty for this player.
    cy.visit('/leaderboard');
    showBoard();
    cy.get('[data-testid="leaderboard-my-row"]').should('not.exist');
  });
});
