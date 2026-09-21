import { HttpErrorResponse } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import type {
  AuthResponse,
  IdentityProvider,
  User,
} from '@world-quiz/shared/contracts';
import { AuthApi } from './auth-api';

export type AuthStatus = 'restoring' | 'signed-out' | 'signed-in';

/** What went wrong in the last sign-in action, for the UI to explain. */
export type AuthError = 'sign-in-failed' | 'unreachable' | 'delete-failed';

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

  private readonly statusState = signal<AuthStatus>('restoring');
  private readonly userState = signal<User | null>(null);
  private readonly busyState = signal(false);
  private readonly errorState = signal<AuthError | null>(null);

  private accessToken: string | null = null;
  /** The refresh in flight, shared by everyone who needs a new token. */
  private refreshing: Promise<boolean> | null = null;

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
   * player is still signed in. Any failure leaves the app signed out.
   */
  async restore(): Promise<void> {
    const refreshed = await this.refreshAccessToken();
    if (!refreshed && this.statusState() === 'restoring') {
      this.statusState.set('signed-out');
    }
  }

  /**
   * Gets a new access token with the refresh cookie. Concurrent callers share
   * one request: the API retires a refresh token on first use, and a second
   * request with the same token would look like theft and sign everyone out.
   */
  refreshAccessToken(): Promise<boolean> {
    this.refreshing ??= this.api
      .refresh()
      .then((response) => {
        this.accept(response);
        return true;
      })
      .catch(() => {
        this.clear();
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

  async signOut(): Promise<void> {
    await this.run(async () => {
      // Signing out locally must work even when the API cannot be reached.
      await this.api.signOut().catch(() => undefined);
      this.clear();
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

  private accept(response: AuthResponse): void {
    this.accessToken = response.accessToken;
    this.userState.set(response.user);
    this.statusState.set('signed-in');
  }

  private clear(): void {
    this.accessToken = null;
    this.userState.set(null);
    this.statusState.set('signed-out');
  }
}

/** No response at all: offline, the API is down, or CORS refused it. */
function isUnreachable(error: unknown): boolean {
  return error instanceof HttpErrorResponse && error.status === 0;
}
