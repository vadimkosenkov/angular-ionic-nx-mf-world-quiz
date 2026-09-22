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
      /**
       * Signs in through the API's development sign-in: the browser gets the
       * httpOnly refresh cookie, and the app restores the session on the next
       * visit. A new player per call unless a subject is given, so tests never
       * share an account or the data on the device.
       */
      signIn(subject?: string, displayName?: string): Chainable<SignedIn>;
    }
  }
}

/** The API of the E2E run (`api:serve-e2e`). */
export const API = 'http://localhost:3333';

export interface SignedIn {
  readonly userId: string;
  /** For calling the API directly from a test. */
  readonly authorization: string;
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

Cypress.Commands.add(
  'signIn',
  (subject = `e2e-${crypto.randomUUID()}`, displayName = 'E2E Player') =>
    cy
      .request('POST', `${API}/v1/auth/dev`, { subject, displayName })
      .then((response): SignedIn => ({
        userId: response.body.user.id,
        authorization: `Bearer ${response.body.accessToken}`,
      })),
);
