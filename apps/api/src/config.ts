import { z } from 'zod';

/**
 * Environment configuration, validated once at startup ("fail fast").
 *
 * Every variable is documented in `.env.example` and
 * docs/development/environment.md. Error messages name the invalid variables
 * but never echo their values, because later variables will contain secrets.
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
  })
  // A production server must use a real PostgreSQL server; the embedded
  // PGlite fallback is for development only.
  .refine(
    (environment) =>
      environment.NODE_ENV !== 'production' ||
      environment.DATABASE_URL !== undefined,
    { path: ['DATABASE_URL'] },
  );

/** Where the data lives: a PostgreSQL server, or PGlite on disk for development. */
export type DatabaseConfig =
  | { readonly kind: 'postgres'; readonly url: string }
  | { readonly kind: 'pglite'; readonly dataDir: string };

export interface ApiConfig {
  readonly nodeEnv: 'development' | 'test' | 'production';
  readonly host: string;
  readonly port: number;
  readonly database: DatabaseConfig;
}

export class InvalidConfigError extends Error {
  constructor(readonly invalidVariables: readonly string[]) {
    super(`Invalid environment configuration: ${invalidVariables.join(', ')}`);
    this.name = 'InvalidConfigError';
  }
}

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

  const { NODE_ENV, HOST, PORT, DATABASE_URL, PGLITE_DIR } = result.data;
  return {
    nodeEnv: NODE_ENV,
    host: HOST,
    port: PORT,
    database: DATABASE_URL
      ? { kind: 'postgres', url: DATABASE_URL }
      : { kind: 'pglite', dataDir: PGLITE_DIR },
  };
}
