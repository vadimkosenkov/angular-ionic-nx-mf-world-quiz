import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { randomBytes } from 'node:crypto';
import { join } from 'node:path';
import { preferredLanguage } from './app/i18n/site-language';
import { siteConfigFromEnvironment } from './app/site-config';

/**
 * The site's Node server: static files, then Angular's server rendering.
 * Pages marked for prerendering (home, legal pages) are served as files; the
 * leaderboard is rendered for every request from the API's current data.
 */
const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();
const angularApp = new AngularNodeAppEngine();

app.disable('x-powered-by');

/**
 * What a browser may do with this site. The policy is strict because the
 * site shows only its own content: scripts and styles come from here, the
 * API is the only origin it talks to, and nothing may frame it.
 *
 * Angular's hydration inlines two executable scripts into every page (the
 * event-replay contract), so each response gets a fresh nonce and those
 * tags are given it; an injected script without the nonce is refused.
 * Styles keep `unsafe-inline`: the build inlines the critical CSS, and
 * Angular adds more at runtime, which a nonce alone would not cover.
 */
const contentSecurityPolicy = (nonce: string): string =>
  [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    `connect-src 'self' ${siteConfigFromEnvironment(process.env).apiUrl}`,
    "form-action 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    'upgrade-insecure-requests',
  ].join('; ');

app.use((_request, response, next) => {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=()',
  );
  next();
});

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
    .then(async (result) => {
      if (!result) {
        next();
        return;
      }
      // Angular's handler answers with pages; anything that is explicitly
      // not HTML is passed through untouched. A page that forgot its
      // content type still counts as HTML — and gets one below.
      const contentType = result.headers.get('content-type');
      if (contentType && !contentType.includes('text/html')) {
        writeResponseToNodeResponse(result, response);
        return;
      }
      // The nonce is minted per response and handed to the tags Angular
      // inlined while rendering.
      const nonce = randomBytes(16).toString('base64');
      const html = (await result.text()).replaceAll(
        /<script(?![^>]*\bnonce=)/g,
        `<script nonce="${nonce}"`,
      );
      result.headers.forEach((value, name) => response.setHeader(name, value));
      response.setHeader(
        'Content-Security-Policy',
        contentSecurityPolicy(nonce),
      );
      response.status(result.status).send(html);
    })
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
