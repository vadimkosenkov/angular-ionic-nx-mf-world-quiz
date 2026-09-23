import type { RequestHandler } from 'express';

/**
 * Headers every API response carries.
 *
 * The API answers JSON, never HTML, so the job here is narrow: make sure a
 * browser cannot be talked into treating an answer as something else, and
 * that nothing is embedded, cached or leaked by accident. (A full CSP
 * belongs to the pages — the site sends its own; see `apps/site/src/server.ts`.)
 */
export function securityHeaders(): RequestHandler {
  return (_request, response, next) => {
    // No MIME sniffing: a JSON body must never be executed as a script.
    response.setHeader('X-Content-Type-Options', 'nosniff');
    // Nothing here is meant to be framed; `frame-ancestors` also covers
    // browsers that ignore X-Frame-Options.
    response.setHeader('Content-Security-Policy', "frame-ancestors 'none'");
    // Do not send the path of the page that called the API to other origins.
    response.setHeader('Referrer-Policy', 'no-referrer');
    // The API has no use for a camera, a microphone or a location.
    response.setHeader(
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=(), payment=()',
    );
    // Player data is per-request and often authorised; shared caches must
    // not keep it. Endpoints that may be cached (the public leaderboards)
    // set their own `Cache-Control` afterwards.
    response.setHeader('Cache-Control', 'no-store');
    next();
  };
}
