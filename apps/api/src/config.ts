import { z } from 'zod';

/** A comma-separated list, e.g. `GOOGLE_CLIENT_IDS=a.apps…,b.apps…`. */
const commaList = z
  .string()
  .optional()
  .transform((value) =>
    (value ?? '')
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0),
  );

const booleanFlag = z
  .enum(['true', 'false'])
  .optional()
  .transform((value) => value === 'true');

/**
 * Environment configuration, validated once at startup ("fail fast").
 *
 * Every variable is documented in `.env.example` and
 * docs/development/environment.md. Error messages name the invalid variables
 * but never echo their values, because several variables contain secrets.
 */
const environmentSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    HOST: z.string().trim().min(1).default('localhost'),
    PORT: z.coerce.number().int().min(1).max(65_535).default(3333),
    DATABASE_URL: z
      .string()
      .trim()
      .regex(/^postgres(ql)?:\/\//)
      .optional(),
    PGLITE_DIR: z.string().trim().min(1).default('.data/pglite'),
    /** HMAC key for access tokens; at least 32 characters. */
    AUTH_JWT_SECRET: z.string().min(32).optional(),
    GOOGLE_CLIENT_IDS: commaList,
    APPLE_CLIENT_IDS: commaList,
    AUTH_DEV_LOGIN: booleanFlag,
    CORS_ORIGINS: commaList,
    COOKIE_SECURE: z.enum(['true', 'false']).optional(),
    /** Requests per client address per 15 minutes on `/v1/auth`. */
    AUTH_RATE_LIMIT: z.coerce.number().int().min(1).default(30),
  })
  // A production server must use a real PostgreSQL server; the embedded
  // PGlite fallback is for development only.
  .refine(
    (environment) =>
      environment.NODE_ENV !== 'production' ||
      environment.DATABASE_URL !== undefined,
    { path: ['DATABASE_URL'] },
  )
  // A production server must have a stable signing key. Elsewhere a random
  // key per start is acceptable: it only signs everyone out on restart.
  .refine(
    (environment) =>
      environment.NODE_ENV !== 'production' ||
      environment.AUTH_JWT_SECRET !== undefined,
    { path: ['AUTH_JWT_SECRET'] },
  )
  // Signing in without a provider must never be possible in production.
  .refine(
    (environment) =>
      environment.NODE_ENV !== 'production' || !environment.AUTH_DEV_LOGIN,
    { path: ['AUTH_DEV_LOGIN'] },
  );

/** Where the data lives: a PostgreSQL server, or PGlite on disk for development. */
export type DatabaseConfig =
  | { readonly kind: 'postgres'; readonly url: string }
  | { readonly kind: 'pglite'; readonly dataDir: string };

export interface AuthConfig {
  /** `null` outside production when unset: a random key is used per start. */
  readonly jwtSecret: string | null;
  /** Accepted `aud` of Google ID tokens; empty disables Google sign-in. */
  readonly googleClientIds: readonly string[];
  /** Accepted `aud` of Apple ID tokens (bundle id, Services ID). */
  readonly appleClientIds: readonly string[];
  /** `POST /v1/auth/dev`, for development and E2E only. */
  readonly devLogin: boolean;
  /** Whether cookies are marked `Secure` (HTTPS only). */
  readonly secureCookies: boolean;
  /** Requests per client address per window on `/v1/auth`. */
  readonly rateLimit: number;
}

export interface ApiConfig {
  readonly nodeEnv: 'development' | 'test' | 'production';
  readonly host: string;
  readonly port: number;
  readonly database: DatabaseConfig;
  readonly auth: AuthConfig;
  /** Browser origins allowed to call the API with credentials. */
  readonly corsOrigins: readonly string[];
}

export class InvalidConfigError extends Error {
  constructor(readonly invalidVariables: readonly string[]) {
    super(`Invalid environment configuration: ${invalidVariables.join(', ')}`);
    this.name = 'InvalidConfigError';
  }
}

/** The shell's and the site's dev servers, allowed outside production. */
export const DEFAULT_DEV_ORIGINS = [
  'http://localhost:4200',
  'http://localhost:4300',
] as const;

export function loadConfig(
  environment: Readonly<Record<string, string | undefined>>,
): ApiConfig {
  const result = environmentSchema.safeParse(environment);

  if (!result.success) {
    const invalidVariables = [
      ...new Set(result.error.issues.map((issue) => String(issue.path[0]))),
    ];
    throw new InvalidConfigError(invalidVariables);
  }

  const env = result.data;
  const production = env.NODE_ENV === 'production';
  return {
    nodeEnv: env.NODE_ENV,
    host: env.HOST,
    port: env.PORT,
    database: env.DATABASE_URL
      ? { kind: 'postgres', url: env.DATABASE_URL }
      : { kind: 'pglite', dataDir: env.PGLITE_DIR },
    auth: {
      jwtSecret: env.AUTH_JWT_SECRET ?? null,
      googleClientIds: env.GOOGLE_CLIENT_IDS,
      appleClientIds: env.APPLE_CLIENT_IDS,
      devLogin: env.AUTH_DEV_LOGIN,
      secureCookies: env.COOKIE_SECURE
        ? env.COOKIE_SECURE === 'true'
        : production,
      rateLimit: env.AUTH_RATE_LIMIT,
    },
    corsOrigins:
      env.CORS_ORIGINS.length > 0 || production
        ? env.CORS_ORIGINS
        : [...DEFAULT_DEV_ORIGINS],
  };
}
