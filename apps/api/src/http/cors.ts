import type { RequestHandler } from 'express';

/**
 * CORS for the web app, which runs on another origin than the API (the shell
 * on :4200, the API on :3333 in development).
 *
 * Only listed origins get CORS headers, and credentials (the refresh cookie)
 * are allowed only for them. There is no wildcard: with credentials, `*` is
 * both forbidden by browsers and unsafe.
 */
export function cors(allowedOrigins: readonly string[]): RequestHandler {
  const allowed = new Set(allowedOrigins);
  return (request, response, next) => {
    const origin = request.headers.origin;
    response.vary('Origin');
    if (!origin || !allowed.has(origin)) {
      next();
      return;
    }

    response.setHeader('Access-Control-Allow-Origin', origin);
    response.setHeader('Access-Control-Allow-Credentials', 'true');
    if (request.method === 'OPTIONS') {
      response.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE');
      response.setHeader(
        'Access-Control-Allow-Headers',
        'Content-Type, Authorization',
      );
      response.setHeader('Access-Control-Max-Age', '600');
      response.status(204).end();
      return;
    }
    next();
  };
}
