/**
 * An achievement unlocked by really learning a region: Oceania has 14
 * countries, and an Easy correct answer is worth one mastery point of three
 * (docs/domain/mastery.md), so three perfect rounds master all of them.
 */
import { answerChoice, byTestId } from '../support/quiz';

const OCEANIA = 14;

const playPerfectOceaniaRound = () => {
  byTestId('quiz-position', { timeout: 20_000 }).should(
    'contain.text',
    `Question 1 of ${OCEANIA}`,
  );
  for (let question = 0; question < OCEANIA; question++) answerChoice(true);
  byTestId('results-score').should(
    'contain.text',
    `${OCEANIA} of ${OCEANIA} correct`,
  );
};

const oceaniaCapitals = () =>
  byTestId('achievement-capitals-oceania-mastered', { timeout: 20_000 });

describe('achievements', () => {
  beforeEach(() => {
    cy.signIn();
  });

  it('unlocks "Oceania · Capitals" once every country is mastered', () => {
    cy.visit('/achievements');
    oceaniaCapitals().should('have.class', 'locked');

    cy.visit(
      `/quiz/capitals?scope=oceania&difficulty=easy&mode=fixed&count=${OCEANIA}`,
    );
    playPerfectOceaniaRound();
    byTestId('results-unlocked').should('not.exist');

    byTestId('results-play-again').click();
    playPerfectOceaniaRound();
    byTestId('results-unlocked').should('not.exist');

    byTestId('results-play-again').click();
    playPerfectOceaniaRound();
    byTestId('results-unlocked').should('contain.text', 'Oceania · Capitals');

    byTestId('results-exit').click();
    cy.get('[data-testid="tab-achievements"]').click();
    oceaniaCapitals()
      .should('have.class', 'unlocked')
      .and('contain.text', 'Unlocked')
      .and('contain.text', `${OCEANIA}/${OCEANIA} mastered`);
    byTestId('achievements-summary').should('contain.text', '1/14 unlocked');
  });
});
