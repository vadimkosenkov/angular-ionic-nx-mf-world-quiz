import { HttpErrorResponse } from '@angular/common/http';
import {
  computed,
  ErrorHandler,
  inject,
  Injectable,
  signal,
} from '@angular/core';
import type {
  AuthResponse,
  IdentityProvider,
  User,
} from '@world-quiz/shared/contracts';
import { AuthApi } from './auth-api';
import { REFRESH_TOKEN_STORE } from './refresh-token-store';

/**
 * `unverified`: a previous sign-in could not be checked because the API was
 * unreachable. The refresh cookie may well be valid, so the app neither
 * claims to be signed in nor shows the sign-in offer; it checks again later.
 */
export type AuthStatus =
  'restoring' | 'unverified' | 'signed-out' | 'signed-in';

/** Held while refreshing, so that tabs of the app take turns (see below). */
export const REFRESH_LOCK = 'world-quiz-auth-refresh';

/** What went wrong in the last sign-in action, for the UI to explain. */
export type AuthError =
  | 'sign-in-failed'
  | 'unreachable'
  | 'delete-failed'
  /** The API refused the nickname (its rules: `nicknameSchema`). */
  | 'nickname-invalid'
  | 'nickname-failed';

/**
 * The signed-in state of the app, as signals.
 *
 * The access token is a plain private field: it is not state the UI renders,
 * and it must never be persisted. After a reload the app is signed in again
 * through `restore()`, which uses the refresh cookie the browser keeps.
 */
@Injectable({ providedIn: 'root' })
export class AuthStore {
  private readonly api = inject(AuthApi);
  private readonly refreshTokens = inject(REFRESH_TOKEN_STORE);
  private readonly errorHandler = inject(ErrorHandler);

  private readonly statusState = signal<AuthStatus>('restoring');
  private readonly userState = signal<User | null>(null);
  private readonly busyState = signal(false);
  private readonly errorState = signal<AuthError | null>(null);

  private accessToken: string | null = null;
  /** The refresh in flight, shared by everyone who needs a new token. */
  private refreshing: Promise<boolean> | null = null;
  /** The last `restore()`, for callers that must wait for its outcome. */
  private restoring: Promise<void> = Promise.resolve();

  readonly status = this.statusState.asReadonly();
  readonly user = this.userState.asReadonly();
  readonly busy = this.busyState.asReadonly();
  readonly error = this.errorState.asReadonly();
  readonly signedIn = computed(() => this.statusState() === 'signed-in');

  /** For the interceptor; `null` when signed out. */
  currentAccessToken(): string | null {
    return this.accessToken;
  }

  /**
   * Signs in again after a reload, silently: a valid refresh cookie means the
   * player is still signed in. When the API refuses the cookie the app is
   * signed out; when the API cannot be reached the sign-in stays `unverified`
   * and `restore()` is called again once the browser is back online.
   */
  restore(): Promise<void> {
    if (this.statusState() === 'signed-in') return Promise.resolve();
    this.statusState.set('restoring');
    this.restoring = this.restoreSession();
    return this.restoring;
  }

  /**
   * The refresh itself. On the web it starts immediately — the cookie needs
   * no lookup — while the app first reads its stored token, which is why
   * that read happens here, inside the lock.
   */
  private refreshRequest(): Promise<AuthResponse> {
    if (this.refreshTokens.delivery !== 'body') return this.api.refresh();
    return this.storedRefreshToken().then((token) => this.api.refresh(token));
  }

  /** The app's stored token; `undefined` on the web (the cookie travels). */
  private async storedRefreshToken(): Promise<string | undefined> {
    if (this.refreshTokens.delivery !== 'body') return undefined;
    const stored = await this.refreshTokens.read().catch((error: unknown) => {
      this.errorHandler.handleError(error);
      return null;
    });
    return stored ?? undefined;
  }

  /**
   * In the app the refresh token is in the Keychain: without one there is no
   * session to restore, and asking the API would only earn a 401 that looks
   * like a refused sign-in. On the web the cookie is invisible here, so the
   * API is always asked.
   */
  private async restoreSession(): Promise<void> {
    if (
      this.refreshTokens.delivery === 'body' &&
      !(await this.storedRefreshToken())
    ) {
      this.statusState.set('signed-out');
      return;
    }
    await this.refreshAccessToken();
  }

  /** Resolves once the last `restore()` has an outcome (route guards). */
  whenRestored(): Promise<void> {
    return this.restoring;
  }

  /**
   * Gets a new access token with the refresh cookie.
   *
   * The API retires a refresh token on first use, and a second request with
   * the same token looks like theft and signs the player out everywhere. So
   * concurrent callers in this tab share one request, and tabs take turns
   * through a Web Lock: a tab that waited sends the cookie its predecessor
   * just received (cookies are shared between tabs).
   *
   * Only the API's refusal of the refresh token (401) signs the player out.
   * Anything else proves nothing about the sign-in: no answer (offline), a
   * server error or rate limit (5xx, 429), a response that breaks the
   * contract, a failed Web Lock. Then a signed-in player stays signed in (the
   * next request retries), and a restore becomes `unverified`. Failures that
   * are not HTTP answers are bugs, so they are also reported.
   */
  refreshAccessToken(): Promise<boolean> {
    // The stored token is read **inside** the lock: the app can run more
    // than one instance of itself (a web view bootstraps the application
    // twice), and two instances presenting the same token look like a
    // stolen one to the API, which then revokes the whole family. Reading
    // after the lock means the second instance sends the rotated token.
    this.refreshing ??= this.exclusively(() => this.refreshRequest())
      .then((response) => {
        this.accept(response);
        return true;
      })
      .catch((error: unknown) => {
        if (isRefusal(error)) {
          this.clear();
          return false;
        }
        if (!(error instanceof HttpErrorResponse)) {
          this.errorHandler.handleError(error);
        }
        if (this.statusState() === 'restoring') {
          this.statusState.set('unverified');
        }
        return false;
      })
      .finally(() => {
        this.refreshing = null;
      });
    return this.refreshing;
  }

  async signIn(
    provider: IdentityProvider,
    idToken: string,
    nonce: string,
  ): Promise<boolean> {
    return this.run(async () => {
      try {
        this.accept(await this.api.signIn(provider, idToken, nonce));
        return true;
      } catch (error) {
        this.errorState.set(
          isUnreachable(error) ? 'unreachable' : 'sign-in-failed',
        );
        return false;
      }
    });
  }

  /** The API's development sign-in (builds that enable it, never production). */
  async signInForDevelopment(subject: string): Promise<boolean> {
    return this.run(async () => {
      try {
        this.accept(await this.api.devSignIn(subject));
        return true;
      } catch (error) {
        this.errorState.set(
          isUnreachable(error) ? 'unreachable' : 'sign-in-failed',
        );
        return false;
      }
    });
  }

  async signOut(): Promise<void> {
    await this.run(async () => {
      // Signing out locally must work even when the API cannot be reached.
      await this.api.signOut().catch(() => undefined);
      this.clear();
    });
  }

  /** Changes the public nickname shown on leaderboards. */
  async setNickname(nickname: string): Promise<boolean> {
    return this.run(async () => {
      try {
        this.userState.set(await this.api.updateNickname(nickname));
        return true;
      } catch (error) {
        this.errorState.set(
          isUnreachable(error)
            ? 'unreachable'
            : error instanceof HttpErrorResponse && error.status === 400
              ? 'nickname-invalid'
              : 'nickname-failed',
        );
        return false;
      }
    });
  }

  async deleteAccount(): Promise<boolean> {
    return this.run(async () => {
      try {
        await this.api.deleteAccount();
        this.clear();
        return true;
      } catch (error) {
        this.errorState.set(
          isUnreachable(error) ? 'unreachable' : 'delete-failed',
        );
        return false;
      }
    });
  }

  private async run<T>(action: () => Promise<T>): Promise<T> {
    this.busyState.set(true);
    this.errorState.set(null);
    try {
      return await action();
    } finally {
      this.busyState.set(false);
    }
  }

  private exclusively<T>(task: () => Promise<T>): Promise<T> {
    const locks = globalThis.navigator?.locks;
    return locks ? locks.request(REFRESH_LOCK, task) : task();
  }

  private accept(response: AuthResponse): void {
    this.accessToken = response.accessToken;
    this.userState.set(response.user);
    this.statusState.set('signed-in');
    // The app gets a new refresh token with every answer (the API rotates
    // them); keeping the old one would sign the player out on the next use.
    if (response.refreshToken) {
      void this.refreshTokens
        .save(response.refreshToken)
        .catch((error: unknown) => this.errorHandler.handleError(error));
    }
  }

  private clear(): void {
    this.accessToken = null;
    this.userState.set(null);
    this.statusState.set('signed-out');
    void this.refreshTokens
      .clear()
      .catch((error: unknown) => this.errorHandler.handleError(error));
  }
}

/** The API refused the refresh token: missing, expired, revoked or reused. */
function isRefusal(error: unknown): boolean {
  return error instanceof HttpErrorResponse && error.status === 401;
}

/** No response at all: offline, the API is down, or CORS refused it. */
function isUnreachable(error: unknown): boolean {
  return error instanceof HttpErrorResponse && error.status === 0;
}
