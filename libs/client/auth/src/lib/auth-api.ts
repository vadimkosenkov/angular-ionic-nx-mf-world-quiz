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

/**
 * The API's sign-in endpoints. Responses are parsed with the shared contract,
 * so a server that answers something unexpected fails loudly here.
 *
 * `/v1/auth` calls send credentials: on the web the refresh token travels only
 * as the httpOnly cookie, which this code can neither read nor write.
 */
@Injectable({ providedIn: 'root' })
export class AuthApi {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = inject(AUTH_CONFIG).apiUrl;

  async signIn(
    provider: IdentityProvider,
    idToken: string,
    nonce: string,
  ): Promise<AuthResponse> {
    const body = await firstValueFrom(
      this.http.post(
        `${this.apiUrl}/v1/auth/${provider}`,
        { idToken, nonce, refreshTokenIn: 'cookie' },
        { withCredentials: true },
      ),
    );
    return authResponseSchema.parse(body);
  }

  async refresh(): Promise<AuthResponse> {
    const body = await firstValueFrom(
      this.http.post(
        `${this.apiUrl}/v1/auth/refresh`,
        {},
        { withCredentials: true },
      ),
    );
    return authResponseSchema.parse(body);
  }

  async signOut(): Promise<void> {
    await firstValueFrom(
      this.http.post(
        `${this.apiUrl}/v1/auth/logout`,
        {},
        { withCredentials: true },
      ),
    );
  }

  /** Needs the access token, which the auth interceptor adds. */
  async me(): Promise<User> {
    return userSchema.parse(
      await firstValueFrom(this.http.get(`${this.apiUrl}/v1/me`)),
    );
  }

  /** Deletes the account; the API also clears the refresh cookie. */
  async deleteAccount(): Promise<void> {
    await firstValueFrom(
      this.http.delete(`${this.apiUrl}/v1/me`, { withCredentials: true }),
    );
  }
}
