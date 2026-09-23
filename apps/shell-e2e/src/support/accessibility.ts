/// <reference types="cypress" />
/**
 * Accessibility checks with axe (WCAG 2.2 A and AA), run against the real
 * screens in the E2E suite.
 *
 * axe finds a subset of the barriers — roughly what a machine can decide —
 * so a clean report is a floor, not a certificate. What it does catch well
 * is exactly what tends to rot: missing names, unlabelled controls, broken
 * heading order, contrast below the threshold.
 */
import 'cypress-axe';
import type { Result } from 'axe-core';

/** The rule sets a failure must belong to. */
const STANDARD = {
  runOnly: {
    type: 'tag' as const,
    values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'],
  },
};

/** Prints every violation in the terminal, not only the count. */
const report = (violations: Result[]) => {
  cy.task(
    'log',
    violations
      .map(
        (violation) =>
          `${violation.impact ?? 'unknown'} · ${violation.id}: ${violation.help}\n    ${violation.nodes
            .map((node) => node.target.join(' '))
            .join('\n    ')}`,
      )
      .join('\n'),
  );
};

/**
 * Checks the page (or one part of it) as it is now. Call it after the screen
 * has settled — axe reads the DOM once.
 */
export const expectAccessible = (context?: string) => {
  cy.injectAxe();
  cy.checkA11y(context, STANDARD, report);
};
