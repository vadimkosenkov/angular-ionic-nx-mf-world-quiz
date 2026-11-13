/**
 * Sharing a finished run and a personal record: the app draws the picture,
 * builds the message in the player's language and hands both to the device.
 * That is the part a unit test cannot show — the real screens, the real
 * translations, a real canvas and the address this deployment is served
 * from.
 */
import { answerChoice, byTestId, recordShares } from '../support/quiz';

/** Where the pictures are written for a look; not committed from here. */
const CARD_FILE = 'dist/share-card/result-card.png';
const RECORD_CARD_FILE = 'dist/share-card/record-card.png';

/** A record of the player's own, so the row has something to share. */
const RECORDS = {
  records: [
    {
      board: 'capitals-easy',
      rank: 2,
      players: 3,
      completionTimeMs: 247_300,
      recordedAt: '2026-11-09T10:05:00.000Z',
    },
  ],
};

describe('sharing', () => {
  beforeEach(() => {
    cy.signIn();
  });

  it('hands a picture of the run to the system share sheet', () => {
    cy.visit('/quiz/capitals?scope=europe&difficulty=easy&mode=fixed&count=1', {
      onBeforeLoad: recordShares(),
    });

    answerChoice(true);
    byTestId('results-share').click();

    cy.window().its('sharedPayloads').should('have.length', 1);
    cy.window()
      .its('sharedPayloads.0.files.0')
      .should((file: File) => {
        expect(file.type).to.eq('image/png');
        expect(file.name).to.match(/\.png$/);
        // A drawn 1080px card is tens of kilobytes; an empty canvas would
        // still be a valid PNG, so the size is what says it has content.
        expect(file.size).to.be.greaterThan(5_000);
      });
    // The message goes with the picture, and carries the address inside it:
    // a sheet holding a file may drop a separate link.
    cy.window().then((win) => {
      cy.window()
        .its('sharedPayloads.0.text')
        .should('contain', 'World Quiz — Capitals, Europe')
        .and('contain', '1/1 correct · 100%')
        .and('contain', win.location.origin);
    });

    // Written out so the card can be looked at, and so a change to the
    // drawing is visible in a pull request rather than only in code.
    cy.window()
      .its('sharedPayloads.0.files.0')
      .then((file: File) => file.arrayBuffer())
      .then((buffer) =>
        cy.writeFile(
          CARD_FILE,
          Cypress.Blob.arrayBufferToBinaryString(buffer),
          'binary',
        ),
      );
  });

  it('shares the run as text where the device takes no files', () => {
    cy.visit('/quiz/capitals?scope=europe&difficulty=easy&mode=fixed&count=1', {
      onBeforeLoad: recordShares({ files: false }),
    });

    answerChoice(true);
    byTestId('results-share').click();

    cy.window().its('sharedPayloads').should('have.length', 1);
    cy.window().its('sharedPayloads.0.files').should('be.undefined');
    cy.window()
      .its('sharedPayloads.0.text')
      .should('contain', 'World Quiz — Capitals, Europe');
    // With no file in the way, the address travels in its own field.
    cy.window().then((win) => {
      cy.window().its('sharedPayloads.0.url').should('eq', win.location.origin);
    });
  });

  it('hands a picture of a personal record to the sheet', () => {
    cy.intercept('GET', '**/v1/me/records', RECORDS);
    cy.visit('/leaderboard', { onBeforeLoad: recordShares() });

    byTestId('leaderboard-view')
      .find('ion-segment-button')
      .last()
      .click({ scrollBehavior: 'center' });
    byTestId('share-record-capitals-easy').click({ scrollBehavior: 'center' });

    cy.window().its('sharedPayloads').should('have.length', 1);
    cy.window()
      .its('sharedPayloads.0.files.0')
      .should((file: File) => {
        expect(file.type).to.eq('image/png');
        expect(file.size).to.be.greaterThan(5_000);
      });
    cy.window()
      .its('sharedPayloads.0.text')
      .should('contain', 'Perfect run in 4:07.3')
      .and('contain', '#2 of 3');

    cy.window()
      .its('sharedPayloads.0.files.0')
      .then((file: File) => file.arrayBuffer())
      .then((buffer) =>
        cy.writeFile(
          RECORD_CARD_FILE,
          Cypress.Blob.arrayBufferToBinaryString(buffer),
          'binary',
        ),
      );
  });

  it('shares a run in Russian when the app is in Russian', () => {
    cy.visit('/settings');
    byTestId('language-ru').click({ scrollBehavior: 'center' });

    cy.visit('/quiz/capitals?scope=europe&difficulty=easy&mode=fixed&count=1', {
      onBeforeLoad: recordShares(),
    });
    answerChoice(true);
    byTestId('results-share').click();

    cy.window().its('sharedPayloads.0.text').should('contain', '1/1 верно');
    cy.window()
      .its('sharedPayloads.0.files.0.size')
      .should('be.greaterThan', 0);
  });
});
