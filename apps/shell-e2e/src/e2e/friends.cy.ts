/**
 * Friends, against the real API (ADR-015): a player is found by the
 * permanent code on their invite, a friendship is mutual and has to be
 * accepted, and a friend's page shows what the public boards already say
 * about them plus their achievements.
 *
 * Two accounts are needed, and the browser can only hold one session: the
 * other player is created first and then acts through the API with their own
 * token, while the browser belongs to whoever signed in last.
 */
import { API, type SignedIn } from '../support/commands';
import { answerRankedRound, byTestId, controlQuizTime } from '../support/quiz';

/** The board a flawless quick round over the whole world on Easy reaches. */
const BOARD = 'capitals-easy-world-fixed';
const ROUND = 10;
const QUIZ = '/quiz/capitals?scope=world&difficulty=easy&mode=fixed';

/** The nickname the other player is known by on every screen. */
const FRIEND_NAME = 'Friendly E2E';

/** Opens the invite from the corner of the Friends header. */
const openInvite = () => {
  byTestId('friends-invite', { timeout: 20_000 }).click();
  byTestId('invite-dialog').should('exist');
};

/** Asks to be friends with the owner of `code`, from the invite dialog. */
const askFor = (code: string) => {
  openInvite();
  cy.get('[data-testid="friend-code"]').type(code);
  byTestId('friend-add').click();
};

describe('friends', () => {
  /** The other player, who acts through the API with their own token. */
  let other: SignedIn;
  let me: SignedIn;

  beforeEach(() => {
    cy.signIn('e2e-friend', 'Friendly Player').then((friend) => {
      other = friend;
      // Every screen shows a player's **nickname**, never the name their
      // provider knows them by, so the other player chooses one.
      cy.request({
        method: 'PATCH',
        url: `${API}/v1/me`,
        headers: { authorization: friend.authorization },
        body: { nickname: FRIEND_NAME },
      });
      // The browser's session is the last one signed in: this player.
      cy.signIn().then((player) => {
        me = player;
      });
    });
  });

  it('asks by code, waits, and shows the friend once they have accepted', () => {
    cy.visit('/friends');
    byTestId('friends-empty', { timeout: 20_000 }).should(
      'contain.text',
      'Nobody here yet',
    );

    // The code as a player reads it off the other screen, in two halves.
    askFor(`${other.inviteCode.slice(0, 4)} ${other.inviteCode.slice(4)}`);
    byTestId('friend-sent', { timeout: 20_000 }).should(
      'contain.text',
      FRIEND_NAME,
    );
    byTestId('toast').should('contain.text', 'Asked');
    // Nothing is a friendship until both have said so.
    cy.get('[data-testid="friend-list"]').should('not.exist');

    cy.request({
      method: 'POST',
      url: `${API}/v1/friends/${me.userId}/accept`,
      headers: { authorization: other.authorization },
    });

    cy.visit('/friends');
    byTestId('friend-list', { timeout: 20_000 }).should(
      'contain.text',
      FRIEND_NAME,
    );
    cy.get('[data-testid="friend-sent"]').should('not.exist');

    // Their page: the records the boards show, and what they have learned.
    cy.get(`[data-testid="friend-${other.userId}"]`).click();
    byTestId('friend-who', { timeout: 20_000 }).should(
      'contain.text',
      FRIEND_NAME,
    );
    // A friend who has never played has no records, which is said in words
    // rather than as 56 empty rows.
    cy.contains('No records yet').should('be.visible');
    byTestId('friend-achievements').should('contain.text', 'Capitals');
  });

  it('marks Home and the bell while somebody is waiting for an answer', () => {
    cy.request({
      method: 'POST',
      url: `${API}/v1/friends/requests`,
      headers: { authorization: other.authorization },
      body: { code: me.inviteCode },
    });

    cy.visit('/home');
    byTestId('friends-requests', { timeout: 20_000 }).should(
      'contain.text',
      '1 request waiting',
    );
    byTestId('notifications-dot').should('exist');
    // The bell is a list of what the app has to say; a request is on it.
    byTestId('notifications').click();
    byTestId('notification-friends').should('contain.text', '1 friend request');
    byTestId('notification-friends').click();

    byTestId('friend-requests', { timeout: 20_000 }).should(
      'contain.text',
      'wants to be friends',
    );
    cy.get(`[data-testid="friend-accept-${other.userId}"]`).click();
    byTestId('friend-list', { timeout: 20_000 }).should(
      'contain.text',
      FRIEND_NAME,
    );
    byTestId('toast').should('contain.text', 'friends now');

    // The news is gone from Home, and so is the mark. The friends screen is
    // pushed over the tabs, so the way back is the header's own button —
    // the tab bar belongs to the page underneath and is hidden.
    cy.get('[data-testid="page-back"]').click();
    byTestId('friends-count').should('contain.text', '1 friend');
  });

  it('takes a request from an invite link, whichever screen it is opened on', () => {
    cy.visit(`/invite/${other.inviteCode}`);

    // The link lands on the friends screen with the request already sent.
    byTestId('friend-sent', { timeout: 20_000 }).should(
      'contain.text',
      FRIEND_NAME,
    );
  });

  it('ends a friendship from the friend page, and both lose the shared board', () => {
    cy.request({
      method: 'POST',
      url: `${API}/v1/friends/requests`,
      headers: { authorization: other.authorization },
      body: { code: me.inviteCode },
    });
    cy.visit('/friends');
    cy.get(`[data-testid="friend-accept-${other.userId}"]`, {
      timeout: 20_000,
    }).click();
    byTestId('friend-list', { timeout: 20_000 }).should('exist');

    cy.get(`[data-testid="friend-${other.userId}"]`).click();
    byTestId('friend-remove', { timeout: 20_000 }).click({
      scrollBehavior: 'center',
    });
    // Removing is confirmed: it costs both of them the shared board.
    byTestId('remove-friend-confirm').click();

    byTestId('friends-empty', { timeout: 20_000 }).should('exist');
    // And the other side can no longer see this player either: not a
    // friend is answered with "no such player", never with a refusal.
    cy.request({
      method: 'GET',
      url: `${API}/v1/friends/${me.userId}`,
      headers: { authorization: other.authorization },
      failOnStatusCode: false,
    })
      .its('status')
      .should('eq', 404);
  });

  it('shows a board over the player and their friends', () => {
    cy.request({
      method: 'POST',
      url: `${API}/v1/friends/requests`,
      headers: { authorization: other.authorization },
      body: { code: me.inviteCode },
    });
    cy.visit('/friends');
    cy.get(`[data-testid="friend-accept-${other.userId}"]`, {
      timeout: 20_000,
    }).click();
    byTestId('friend-list', { timeout: 20_000 }).should('exist');

    // A flawless quick round, played the ordinary way, reaches the board of
    // its own settings.
    cy.visit(QUIZ, { onBeforeLoad: controlQuizTime });
    byTestId('quiz-position', { timeout: 20_000 }).should(
      'contain.text',
      `Question 1 of ${ROUND}`,
    );
    answerRankedRound(ROUND);
    byTestId('results-rank', { timeout: 20_000 }).should('contain.text', '#');
    byTestId('results-exit').click();

    cy.get('[data-testid="tab-leaderboard"]').click();
    byTestId('board-show', { timeout: 20_000 }).click({
      scrollBehavior: 'center',
    });
    byTestId('leaderboard-ranking', { timeout: 20_000 }).should('exist');

    // The same board, over fewer people: the player is on it, and their
    // friend — who has never played — is not.
    cy.get(
      '[data-testid="leaderboard-audience"] ion-segment-button[value="friends"]',
    ).click();
    cy.get('[data-testid="leaderboard-entries"] li[aria-current="true"]', {
      timeout: 20_000,
    }).should('exist');
    cy.get('[data-testid="leaderboard-entries"] li').should('have.length', 1);
    // The API answers the same thing to the player's own request.
    cy.request({
      method: 'GET',
      url: `${API}/v1/friends/leaderboards/${BOARD}`,
      headers: { authorization: me.authorization },
    })
      .its('body.players')
      .should('eq', 1);
  });
});
