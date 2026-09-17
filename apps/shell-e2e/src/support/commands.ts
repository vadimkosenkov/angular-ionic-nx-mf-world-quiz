/// <reference types="cypress" />

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable {
      /** Opens a route with the OS colour scheme forced to light or dark. */
      visitWithScheme(
        path: string,
        scheme: 'light' | 'dark',
      ): Chainable<AUTWindow>;
    }
  }
}

Cypress.Commands.add(
  'visitWithScheme',
  (path: string, scheme: 'light' | 'dark') =>
    cy.visit(path, {
      onBeforeLoad(win) {
        const original = win.matchMedia.bind(win);
        win.matchMedia = (query: string) => {
          const list = original(query);
          if (query !== '(prefers-color-scheme: dark)') return list;
          // Keep the real object (its methods live on the prototype); only
          // override what it reports.
          Object.defineProperty(list, 'matches', { value: scheme === 'dark' });
          return list;
        };
      },
    }),
);

export {};
