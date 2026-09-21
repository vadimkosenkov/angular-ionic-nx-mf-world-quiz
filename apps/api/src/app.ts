import type { Clock } from '@world-quiz/shared/util';
import express, { type ErrorRequestHandler, type Express } from 'express';
import { rateLimit } from 'express-rate-limit';
import type { AccessTokens } from './auth/access-tokens';
import type { AuthService } from './auth/auth-service';
import { authRouter } from './auth/auth.routes';
import { meRouter } from './auth/me.routes';
import { requireAuth } from './auth/require-auth';
import { cors } from './http/cors';
import { sendProblem } from './http/problem';
import type { SessionService } from './sessions/session-service';
import { sessionsRouter } from './sessions/sessions.routes';

export interface AppDependencies {
  readonly clock: Clock;
  readonly sessions: SessionService;
  readonly auth: AuthService;
  readonly accessTokens: AccessTokens;
  readonly options?: Partial<AppOptions>;
  /** Where unexpected errors are reported (the console in production). */
  readonly logError?: (error: unknown) => void;
}

export interface AppOptions {
  /** Browser origins allowed to call the API with credentials. */
  readonly corsOrigins: readonly string[];
  /** Enables `POST /v1/auth/dev` (never in production; see config). */
  readonly devLogin: boolean;
  readonly secureCookies: boolean;
  /** Requests per client address and window on `/v1/auth`. */
  readonly authRateLimit: number;
}

const DEFAULT_OPTIONS: AppOptions = {
  corsOrigins: [],
  devLogin: false,
  secureCookies: true,
  authRateLimit: 30,
};

/** Largest accepted JSON body. A 1000-answer session is well below this. */
export const MAX_BODY_SIZE = '256kb';
/** Window of the `/v1/auth` rate limit. */
export const AUTH_RATE_WINDOW_MS = 15 * 60 * 1000;

/**
 * Builds the Express application without starting a server.
 *
 * Keeping construction separate from `listen()` lets API tests exercise the
 * real middleware stack in-process (supertest) and lets tests inject
 * deterministic dependencies such as a manual clock and an in-memory database.
 */
export function createApp({
  clock,
  sessions,
  auth,
  accessTokens,
  options: overrides = {},
  logError = (error) => console.error('[api] unexpected error', error),
}: AppDependencies): Express {
  const options: AppOptions = { ...DEFAULT_OPTIONS, ...overrides };
  const app = express();

  // Do not advertise the framework to clients.
  app.disable('x-powered-by');
  app.use(cors(options.corsOrigins));
  app.use(express.json({ limit: MAX_BODY_SIZE }));

  app.get('/health', (_request, response) => {
    response.json({ status: 'ok', time: new Date(clock.now()).toISOString() });
  });

  // Sign-in endpoints are the target of credential stuffing and token
  // guessing, so they are rate-limited per client address.
  const authLimiter = rateLimit({
    windowMs: AUTH_RATE_WINDOW_MS,
    limit: options.authRateLimit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_request, response) =>
      sendProblem(response, {
        status: 429,
        title: 'Too Many Requests',
        detail: 'Too many sign-in attempts. Try again later.',
      }),
  });
  app.use(
    '/v1/auth',
    authLimiter,
    authRouter(auth, {
      devLogin: options.devLogin,
      secureCookies: options.secureCookies,
    }),
  );

  const signedIn = requireAuth(accessTokens, clock);
  app.use(
    '/v1/me',
    signedIn,
    meRouter(auth, { secureCookies: options.secureCookies }),
  );
  app.use('/v1/sessions', signedIn, sessionsRouter(sessions));

  // Unknown routes answer with an RFC 9457 problem-details body.
  app.use((request, response) => {
    sendProblem(response, {
      status: 404,
      title: 'Not Found',
      detail: `No route matches ${request.method} ${request.path}`,
    });
  });

  // Errors thrown by middleware or handlers. Express 5 forwards rejected
  // promises from async handlers here. Details stay in the server log; the
  // client learns only what it can act on.
  const handleError: ErrorRequestHandler = (
    error,
    _request,
    response,
    _next,
  ) => {
    const type = (error as { type?: string } | null)?.type;
    if (type === 'entity.parse.failed') {
      sendProblem(response, {
        status: 400,
        title: 'Malformed JSON',
        detail: 'The request body is not valid JSON.',
      });
      return;
    }
    if (type === 'entity.too.large') {
      sendProblem(response, {
        status: 413,
        title: 'Payload Too Large',
        detail: `Request bodies are limited to ${MAX_BODY_SIZE}.`,
      });
      return;
    }

    logError(error);
    sendProblem(response, {
      status: 500,
      title: 'Internal Server Error',
      detail: 'The request could not be completed.',
    });
  };
  app.use(handleError);

  return app;
}
