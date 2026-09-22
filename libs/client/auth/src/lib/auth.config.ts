import { InjectionToken } from '@angular/core';

export interface AuthConfig {
  /** Origin of the World Quiz API, e.g. `http://localhost:3333`. */
  readonly apiUrl: string;
  /** Google web client id; `null` hides Google sign-in. */
  readonly googleClientId: string | null;
}

export const AUTH_CONFIG = new InjectionToken<AuthConfig>('AUTH_CONFIG');
