import type { IdentityProvider, User } from '@world-quiz/shared/contracts';
import { err, ok, type Result } from '@world-quiz/shared/util';
import type { Clock } from '@world-quiz/shared/util';
import type { AccessTokens } from './access-tokens';
import type { IdentityError, IdentityVerifier } from './identity-verifier';
import type { RefreshError, RefreshTokenStore } from './refresh-tokens';
import type { IdentityKey, UserRepository } from './user-repository';

/** What a successful sign-in or refresh hands to the client. */
export interface IssuedSession {
  readonly user: User;
  readonly accessToken: string;
  readonly accessTokenExpiresAt: number;
  readonly refreshToken: string;
  readonly refreshTokenExpiresAt: number;
}

export interface AuthService {
  signIn(
    provider: IdentityProvider,
    idToken: string,
    options: { nonce?: string; displayName?: string },
  ): Promise<Result<IssuedSession, IdentityError>>;
  /** Development and E2E only; the route exists only when enabled. */
  devSignIn(subject: string, displayName?: string): Promise<IssuedSession>;
  refresh(
    refreshToken: string,
  ): Promise<Result<IssuedSession, RefreshError | 'user-gone'>>;
  signOut(refreshToken: string): Promise<void>;
  currentUser(userId: string): Promise<User | null>;
  /** Deletes the account and all its data (sessions, tokens, identities). */
  deleteAccount(userId: string): Promise<boolean>;
}

export interface AuthServiceDependencies {
  readonly users: UserRepository;
  readonly refreshTokens: RefreshTokenStore;
  readonly accessTokens: AccessTokens;
  readonly identities: IdentityVerifier;
  readonly clock: Clock;
}

export function createAuthService({
  users,
  refreshTokens,
  accessTokens,
  identities,
  clock,
}: AuthServiceDependencies): AuthService {
  const startSession = async (
    identity: IdentityKey,
    displayName: string | null,
  ): Promise<IssuedSession> => {
    const now = clock.now();
    const user = await users.findOrCreate(identity, displayName, now);
    const access = await accessTokens.issue(user.id, now);
    const refresh = await refreshTokens.issue(user.id, now);
    return {
      user,
      accessToken: access.token,
      accessTokenExpiresAt: access.expiresAt,
      refreshToken: refresh.token,
      refreshTokenExpiresAt: refresh.expiresAt,
    };
  };

  return {
    async signIn(provider, idToken, { nonce, displayName }) {
      const verified = await identities.verify(
        provider,
        idToken,
        nonce,
        clock.now(),
      );
      if (!verified.ok) return verified;
      return ok(await startSession(verified.value, displayName ?? null));
    },

    devSignIn: (subject, displayName) =>
      startSession(
        { provider: 'dev', subject, email: null },
        displayName ?? null,
      ),

    async refresh(refreshToken) {
      const now = clock.now();
      const rotated = await refreshTokens.rotate(refreshToken, now);
      if (!rotated.ok) return rotated;

      const user = await users.findById(rotated.value.userId);
      if (!user) return err('user-gone');
      const access = await accessTokens.issue(user.id, now);
      return ok({
        user,
        accessToken: access.token,
        accessTokenExpiresAt: access.expiresAt,
        refreshToken: rotated.value.next.token,
        refreshTokenExpiresAt: rotated.value.next.expiresAt,
      });
    },

    signOut: (refreshToken) =>
      refreshTokens.revokeFamily(refreshToken, clock.now()),
    currentUser: (userId) => users.findById(userId),
    deleteAccount: (userId) => users.delete(userId),
  };
}
