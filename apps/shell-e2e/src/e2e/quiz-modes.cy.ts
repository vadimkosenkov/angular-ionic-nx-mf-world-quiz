/**
 * The game modes and Hard mode, played in the real remotes: Time attack
 * (ended by moving the quiz's clock), Endless with "Finish" and "Play again",
 * typed answers, and a quiz played in Russian. Rule permutations are unit
 * tests; these prove the modes are wired end to end, including the server
 * accepting what they record.
 */
import {
  advanceQuizTime,
  answerChoice,
  askedCountry,
  askedCountryKey,
  byTestId,
  controlQuizTime,
} from '../support/quiz';

/** Every result reached the account: the server graded and kept it. */
const expectSavedToAccount = () => {
  cy.visit('/settings');
  byTestId('sync-status').should(
    'contain.text',
    'All your results are saved to your account.',
  );
};

describe('game modes', () => {
  beforeEach(() => {
    cy.signIn();
  });

  it('ends a Time attack when the minute is up and records it', () => {
    cy.visit('/quiz/capitals?scope=world&difficulty=easy&mode=timed', {
      onBeforeLoad: controlQuizTime,
    });
    byTestId('quiz-timer', { timeout: 20_000 }).should(
      'contain.text',
      'Time left: 60',
    );

    answerChoice(true);
    answerChoice(true);
    answerChoice(false);
    askedCountry();
    advanceQuizTime(61_000);

    byTestId('results-score').should('contain.text', '2 of 3 correct');
    byTestId('results-exit').click();
    byTestId('practice-capitals').should('contain.text', '1 country to review');
    expectSavedToAccount();
  });

  it('plays Endless until "Finish", then plays again', () => {
    cy.visit('/quiz/flags?scope=europe&difficulty=easy&mode=endless');

    answerChoice(true);
    answerChoice(false);
    answerChoice(true);
    byTestId('quiz-position').should('contain.text', 'Question 4');
    byTestId('quiz-finish').click();

    byTestId('results-score').should('contain.text', '2 of 3 correct');
    byTestId('results-review').should('be.visible');

    byTestId('results-play-again').click();
    byTestId('quiz-position').should('contain.text', 'Question 1');
    byTestId('quiz-score').should('contain.text', '0');
    byTestId('results-score').should('not.exist');

    byTestId('quiz-exit').click();
    byTestId('practice-flags').should('contain.text', '1 country to review');
    expectSavedToAccount();
  });

  it('checks typed answers in Hard mode and shows the right one', () => {
    cy.visit('/quiz/capitals?scope=europe&difficulty=hard&mode=fixed&count=2');

    // Case and surrounding spaces do not matter.
    askedCountryKey().then((country) =>
      cy
        .get('[data-testid="quiz-answer-input"] input')
        .type(`  ${country.capital.en.toLowerCase()} {enter}`),
    );
    byTestId('quiz-feedback')
      .should('have.class', 'correct')
      .and('contain.text', 'Correct');
    byTestId('quiz-continue').click();

    askedCountryKey().then((country) => {
      cy.get('[data-testid="quiz-answer-input"] input').type('Atlantis');
      byTestId('quiz-submit').click();
      byTestId('quiz-feedback')
        .should('not.have.class', 'correct')
        .and('contain.text', 'Not quite');
      byTestId('quiz-correct-answer').should(
        'contain.text',
        country.capital.en,
      );
    });
    byTestId('quiz-continue').click();

    byTestId('results-score').should('contain.text', '1 of 2 correct');
  });

  it('plays in Russian: country names from the dataset, Russian answers', () => {
    cy.visit('/settings');
    byTestId('language-ru').click();
    cy.get('html').should('have.attr', 'lang', 'ru');

    cy.visit('/quiz/capitals?scope=europe&difficulty=hard&mode=fixed&count=1');
    byTestId('quiz-question').should('contain.text', 'Какая здесь столица?');
    askedCountryKey().then((country) => {
      byTestId('quiz-country').should('contain.text', country.name.ru);
      cy.get('[data-testid="quiz-answer-input"] input').type(
        `${country.capital.ru}{enter}`,
      );
    });
    byTestId('quiz-feedback')
      .should('have.class', 'correct')
      .and('contain.text', 'Верно');
  });
});
