/**
 * What a browser needs before it will offer to install the app, and what
 * iOS reads when someone adds it to the home screen. These are files and
 * tags, so the checks are requests: a missing icon or a manifest that stops
 * being served breaks installation silently, months after anyone looked.
 */
describe('installable', () => {
  it('serves a manifest that describes the app', () => {
    cy.request('/manifest.webmanifest').then(({ status, body }) => {
      expect(status).to.equal(200);
      const manifest = typeof body === 'string' ? JSON.parse(body) : body;
      expect(manifest.name).to.equal('World Quiz');
      expect(manifest.display).to.equal('standalone');
      expect(manifest.start_url).to.equal('/home');
      // Chrome wants 192 and 512; Android wants one it may crop.
      const sizes = manifest.icons.map(
        (icon: { sizes: string; purpose?: string }) =>
          `${icon.sizes}/${icon.purpose ?? 'any'}`,
      );
      expect(sizes).to.include.members([
        '192x192/any',
        '512x512/any',
        '512x512/maskable',
      ]);
    });
  });

  it('serves every icon the manifest promises', () => {
    cy.request('/manifest.webmanifest').then(({ body }) => {
      const manifest = typeof body === 'string' ? JSON.parse(body) : body;
      for (const icon of manifest.icons as { src: string }[]) {
        cy.request(`/${icon.src}`)
          .its('headers.content-type')
          .should('contain', 'image/png');
      }
    });
    // iOS ignores the manifest's icons and reads this tag instead.
    cy.request('/icons/apple-touch-icon.png')
      .its('status')
      .should('equal', 200);
  });

  it('links the manifest and the iOS tags from the page', () => {
    cy.request('/index.html').then(({ body }) => {
      expect(body).to.contain('rel="manifest"');
      expect(body).to.contain('rel="apple-touch-icon"');
      expect(body).to.contain('name="apple-mobile-web-app-capable"');
    });
  });

  it('serves the service worker as a script', () => {
    cy.request('/service-worker.js').then(({ status, headers, body }) => {
      expect(status).to.equal(200);
      expect(headers['content-type']).to.contain('javascript');
      // The rule that matters most: the API is never served from a cache.
      expect(body).to.contain("pathname.startsWith('/v1/')");
    });
  });
});
