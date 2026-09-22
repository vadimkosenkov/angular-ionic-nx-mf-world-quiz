import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { join } from 'node:path';
import { preferredLanguage } from './app/i18n/site-language';

/**
 * The site's Node server: static files, then Angular's server rendering.
 * Pages marked for prerendering (home, legal pages) are served as files; the
 * leaderboard is rendered for every request from the API's current data.
 */
const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();
const angularApp = new AngularNodeAppEngine();

app.disable('x-powered-by');

// `/` picks the visitor's language; every page lives under `/en` or `/ru`.
app.get('/', (request, response) => {
  response.setHeader('Vary', 'Accept-Language');
  response.redirect(
    302,
    `/${preferredLanguage(request.headers['accept-language'])}`,
  );
});

app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

app.use((request, response, next) => {
  angularApp
    .handle(request)
    .then((result) =>
      result ? writeResponseToNodeResponse(result, response) : next(),
    )
    .catch(next);
});

if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = Number(process.env['PORT'] ?? 4300);
  app.listen(port, (error) => {
    if (error) throw error;
    console.log(`[site] listening on http://localhost:${port}`);
  });
}

/** The request handler for the Angular CLI (dev server, build). */
export const reqHandler = createNodeRequestHandler(app);
