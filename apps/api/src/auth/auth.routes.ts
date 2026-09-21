import {
  type AuthResponse,
  devSignInRequestSchema,
  type IdentityProvider,
  refreshRequestSchema,
  type RefreshTokenDelivery,
  signInRequestSchema,
} from '@world-quiz/shared/contracts';
import { Router, type Request, type Response } from 'express';
import {
  readCookie,
  REFRESH_COOKIE,
  refreshCookieOptions,
} from '../http/cookies';
import { sendProblem, validationErrors } from '../http/problem';
import type { AuthService, IssuedSession } from './auth-service';

export interface AuthRoutesOptions {
  readonly devLogin: boolean;
  readonly secureCookies: boolean;
}

/**
 * `/v1/auth` — signing in, refreshing and signing out.
 *
 * The refresh token goes where the client asks: an httpOnly, SameSite=Strict
 * cookie scoped to `/v1/auth` for the web app (JavaScript never sees it), or
 * the response body for the native app, which keeps it in the Keychain.
 */
export function authRouter(
  auth: AuthService,
  { devLogin, secureCookies }: AuthRoutesOptions,
): Router {
  const router = Router();

  const setRefreshCookie = (response: Response, session: IssuedSession) =>
    response.cookie(REFRESH_COOKIE, session.refreshToken, {
      ...refreshCookieOptions(secureCookies),
      expires: new Date(session.refreshTokenExpiresAt),
    });

  const clearRefreshCookie = (response: Response) =>
    response.clearCookie(REFRESH_COOKIE, refreshCookieOptions(secureCookies));

  const sendSession = (
    response: Response,
    session: IssuedSession,
    delivery: RefreshTokenDelivery,
  ) => {
    const body: AuthResponse = {
      user: session.user,
      accessToken: session.accessToken,
      accessTokenExpiresAt: new Date(
        session.accessTokenExpiresAt,
      ).toISOString(),
      ...(delivery === 'body' ? { refreshToken: session.refreshToken } : {}),
    };
    if (delivery === 'cookie') setRefreshCookie(response, session);
    // Tokens must never be cached by a browser or a proxy.
    response.setHeader('Cache-Control', 'no-store');
    response.json(body);
  };

  const invalidBody = (
    response: Response,
    error: Parameters<typeof validationErrors>[0],
  ) =>
    sendProblem(response, {
      status: 400,
      title: 'Invalid request',
      errors: validationErrors(error),
    });

  const unauthorized = (response: Response, detail: string) =>
    sendProblem(response, { status: 401, title: 'Unauthorized', detail });

  const signInWith =
    (provider: IdentityProvider) =>
    async (request: Request, response: Response) => {
      const parsed = signInRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        invalidBody(response, parsed.error);
        return;
      }
      const result = await auth.signIn(provider, parsed.data.idToken, {
        nonce: parsed.data.nonce,
        displayName: parsed.data.displayName,
      });
      if (!result.ok) {
        if (result.error === 'provider-not-configured') {
          sendProblem(response, {
            status: 503,
            title: 'Sign-in provider unavailable',
            detail: `Sign-in with ${provider} is not configured on this server.`,
          });
        } else {
          // Deliberately vague: which check failed helps an attacker more
          // than a legitimate client.
          unauthorized(response, 'The identity token could not be verified.');
        }
        return;
      }
      sendSession(response, result.value, parsed.data.refreshTokenIn);
    };

  router.post('/google', signInWith('google'));
  router.post('/apple', signInWith('apple'));

  if (devLogin) {
    router.post('/dev', async (request, response) => {
      const parsed = devSignInRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        invalidBody(response, parsed.error);
        return;
      }
      const session = await auth.devSignIn(
        parsed.data.subject,
        parsed.data.displayName,
      );
      sendSession(response, session, parsed.data.refreshTokenIn);
    });
  }

  /** The body's token (native) or the cookie (web). */
  const presentedRefreshToken = (request: Request, bodyToken?: string) =>
    bodyToken ?? readCookie(request.headers.cookie, REFRESH_COOKIE);

  router.post('/refresh', async (request, response) => {
    const parsed = refreshRequestSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      invalidBody(response, parsed.error);
      return;
    }
    const token = presentedRefreshToken(request, parsed.data.refreshToken);
    if (!token) {
      unauthorized(response, 'No refresh token.');
      return;
    }
    const result = await auth.refresh(token);
    if (!result.ok) {
      clearRefreshCookie(response);
      unauthorized(response, 'Sign in again.');
      return;
    }
    sendSession(response, result.value, parsed.data.refreshTokenIn);
  });

  router.post('/logout', async (request, response) => {
    const parsed = refreshRequestSchema.safeParse(request.body ?? {});
    const token = presentedRefreshToken(
      request,
      parsed.success ? parsed.data.refreshToken : undefined,
    );
    if (token) await auth.signOut(token);
    clearRefreshCookie(response);
    response.status(204).end();
  });

  return router;
}
