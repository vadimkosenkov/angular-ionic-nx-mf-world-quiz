/**
 * The app is mobile-first, but the other journeys run in Cypress's default
 * desktop-sized viewport. On a phone the floating tab bar and action bar
 * cover the bottom of the page, and a page must leave room for them: the
 * last item must stay reachable when the page is scrolled to the end.
 */
import { byTestId } from '../support/quiz';

/** Scrolls the Ionic page that contains `element` to its end. */
const scrollPageToEnd = (element: JQuery<HTMLElement>) =>
  cy.wrap(element.closest('ion-content')).then(($content) =>
    (
      $content[0] as HTMLElement & {
        scrollToBottom(duration: number): Promise<void>;
      }
    ).scrollToBottom(0),
  );

/** `item` ends above the top of `cover`, which floats over the page. */
const expectAbove = (item: string, cover: string) =>
  cy.get(item).then(($item) =>
    cy.get(cover).then(($cover) => {
      const itemBottom = $item.get(0).getBoundingClientRect().bottom;
      const coverTop = $cover.get(0).getBoundingClientRect().top;
      expect(itemBottom, `${item} ends above ${cover}`).to.be.at.most(coverTop);
    }),
  );

describe('phone layout', () => {
  beforeEach(() => {
    cy.viewport('iphone-x');
    cy.signIn();
  });

  it('keeps the end of Home above the tab bar', () => {
    cy.visit('/home');
    byTestId('achievement-preview', { timeout: 20_000 }).then(scrollPageToEnd);
    expectAbove('[data-testid="achievement-preview"]', 'ion-tab-bar');
  });

  it("keeps the quiz setup's own Start button reachable", () => {
    // The action is in the page, under the last choice, rather than in a bar
    // pinned to the foot of the screen -- so what must stay reachable at the
    // end of the page is the button itself. (The setup is pushed over the
    // tabs, so there is no tab bar on this screen to measure against.)
    cy.visit('/quiz/setup?category=capitals');
    byTestId('setup-start', { timeout: 20_000 }).then(scrollPageToEnd);
    cy.get('[data-testid="setup-start"]')
      .should('be.visible')
      .then(($button) => {
        const { bottom } = $button.get(0).getBoundingClientRect();
        cy.window().then((win) => {
          expect(bottom, 'Start ends inside the screen').to.be.at.most(
            win.innerHeight,
          );
        });
      });
  });
});
