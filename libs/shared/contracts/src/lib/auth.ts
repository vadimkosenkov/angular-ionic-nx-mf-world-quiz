import { z } from 'zod';
import { uuidSchema } from './common';

/** Identity providers the API accepts ID tokens from. */
export const IDENTITY_PROVIDERS = ['google', 'apple'] as const;
export type IdentityProvider = (typeof IDENTITY_PROVIDERS)[number];

/**
 * Where the client wants its refresh token:
 * - `cookie` (web): an httpOnly cookie that JavaScript cannot read;
 * - `body` (native app): in the response, for the device's secure storage
 *   (Keychain on iOS).
 */
export const REFRESH_TOKEN_DELIVERIES = ['cookie', 'body'] as const;
export type RefreshTokenDelivery = (typeof REFRESH_TOKEN_DELIVERIES)[number];

/** A provider's ID token is a JWT: three base64url segments. */
const idTokenSchema = z
  .string()
  .max(8192)
  .regex(/^[\w-]+\.[\w-]+\.[\w-]+$/);

/**
 * `POST /v1/auth/google` and `POST /v1/auth/apple`: sign in with an ID token
 * the client obtained from the provider. The server verifies it; the client's
 * word about who the user is counts for nothing.
 */
export const signInRequestSchema = z.strictObject({
  idToken: idTokenSchema,
  /** The nonce the client passed to the provider (raw, not hashed). */
  nonce: z.string().min(16).max(128).optional(),
  /** Apple sends the name only to the app, and only on the first sign-in. */
  displayName: z.string().trim().min(1).max(100).optional(),
  refreshTokenIn: z.enum(REFRESH_TOKEN_DELIVERIES).default('cookie'),
});
export type SignInRequest = z.infer<typeof signInRequestSchema>;

/**
 * `POST /v1/auth/dev`: development and E2E sign-in without a provider.
 * Disabled unless the server enables it, and never available in production.
 */
export const devSignInRequestSchema = z.strictObject({
  subject: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[\w.-]+$/),
  displayName: z.string().trim().min(1).max(100).optional(),
  refreshTokenIn: z.enum(REFRESH_TOKEN_DELIVERIES).default('cookie'),
});
export type DevSignInRequest = z.infer<typeof devSignInRequestSchema>;

/**
 * `POST /v1/auth/refresh` and `POST /v1/auth/logout`: the refresh token comes
 * from the body (native) or, when absent, from the httpOnly cookie (web).
 */
export const refreshRequestSchema = z.strictObject({
  refreshToken: z.string().min(20).max(200).optional(),
  refreshTokenIn: z.enum(REFRESH_TOKEN_DELIVERIES).default('cookie'),
});
export type RefreshRequest = z.infer<typeof refreshRequestSchema>;

export const userSchema = z.object({
  id: uuidSchema,
  displayName: z.string().nullable(),
  /** The public name on leaderboards (a default until the player picks one). */
  nickname: z.string(),
  /** From the provider, if it shared one. Never used to link accounts. */
  email: z.string().nullable(),
  providers: z.array(z.enum([...IDENTITY_PROVIDERS, 'dev'])),
  createdAt: z.iso.datetime(),
});
export type User = z.infer<typeof userSchema>;

export const authResponseSchema = z.object({
  user: userSchema,
  /** Short-lived bearer token for `Authorization: Bearer …`. */
  accessToken: z.string(),
  accessTokenExpiresAt: z.iso.datetime(),
  /** Present only when the client asked for `refreshTokenIn: 'body'`. */
  refreshToken: z.string().optional(),
});
export type AuthResponse = z.infer<typeof authResponseSchema>;
