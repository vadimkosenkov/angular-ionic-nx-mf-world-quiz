import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  type AuthResponse,
  authResponseSchema,
  type IdentityProvider,
  type User,
  userSchema,
} from '@world-quiz/shared/contracts';
import { firstValueFrom } from 'rxjs';
import { AUTH_CONFIG } from './auth.config';
import { REFRESH_TOKEN_STORE } from './refresh-token-store';

/**
 * The API's sign-in endpoints. Responses are parsed with the shared contract,
 * so a server that answers something unexpected fails loudly here.
 *
 * `/v1/auth` calls send credentials: on the web the refresh token travels only
 * as the httpOnly cookie, which this code can neither read nor write. In the
 * iPhone app there is no cookie — the token comes back in the body and is
 * kept in the Keychain (`REFRESH_TOKEN_STORE`), so it has to be sent back
 * explicitly.
 */
@Injectable({ providedIn: 'root' })
export class AuthApi {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = inject(AUTH_CONFIG).apiUrl;
  private readonly refreshTokens = inject(REFRESH_TOKEN_STORE);

  async signIn(
    provider: IdentityProvider,
    idToken: string,
    nonce: string,
  ): Promise<AuthResponse> {
    const body = await firstValueFrom(
      this.http.post(
        `${this.apiUrl}/v1/auth/${provider}`,
        {
          idToken,
          nonce,
          refreshTokenIn: this.refreshTokens.delivery,
        },
        { withCredentials: true },
      ),
    );
    return authResponseSchema.parse(body);
  }

  /**
   * `POST /v1/auth/dev`: the API's development sign-in, without a provider.
   * Only reachable from a build that asks for it (see the shell's runtime
   * configuration) and only from an API that enables it — never production.
   */
  async devSignIn(subject: string): Promise<AuthResponse> {
    const body = await firstValueFrom(
      this.http.post(
        `${this.apiUrl}/v1/auth/dev`,
        { subject, refreshTokenIn: this.refreshTokens.delivery },
        { withCredentials: true },
      ),
    );
    return authResponseSchema.parse(body);
  }

  /**
   * `refreshToken` is the app's stored token; the web passes nothing and the
   * cookie travels by itself. The caller reads the store, because that read
   * must happen inside the lock that serialises refreshes (see `AuthStore`).
   */
  async refresh(refreshToken?: string): Promise<AuthResponse> {
    const body = await firstValueFrom(
      this.http.post(
        `${this.apiUrl}/v1/auth/refresh`,
        {
          refreshTokenIn: this.refreshTokens.delivery,
          ...(refreshToken ? { refreshToken } : {}),
        },
        { withCredentials: true },
      ),
    );
    return authResponseSchema.parse(body);
  }

  async signOut(): Promise<void> {
    // As in `refresh`: the web sends the cookie and starts at once, the app
    // has to look its token up first.
    const body =
      this.refreshTokens.delivery === 'body'
        ? await this.logoutBody()
        : { refreshTokenIn: 'cookie' };
    await firstValueFrom(
      this.http.post(`${this.apiUrl}/v1/auth/logout`, body, {
        withCredentials: true,
      }),
    );
  }

  /** The app's stored token in the body; the web sends only the delivery. */
  private async logoutBody(): Promise<Record<string, string>> {
    const token = await this.refreshTokens.read();
    return {
      refreshTokenIn: this.refreshTokens.delivery,
      ...(token ? { refreshToken: token } : {}),
    };
  }

  /** Needs the access token, which the auth interceptor adds. */
  async me(): Promise<User> {
    return userSchema.parse(
      await firstValueFrom(this.http.get(`${this.apiUrl}/v1/me`)),
    );
  }

  /** Sets the public nickname; answers the updated user. */
  async updateNickname(nickname: string): Promise<User> {
    return userSchema.parse(
      await firstValueFrom(
        this.http.patch(`${this.apiUrl}/v1/me`, { nickname }),
      ),
    );
  }

  /** Deletes the account; the API also clears the refresh cookie. */
  async deleteAccount(): Promise<void> {
    await firstValueFrom(
      this.http.delete(`${this.apiUrl}/v1/me`, { withCredentials: true }),
    );
  }
}
