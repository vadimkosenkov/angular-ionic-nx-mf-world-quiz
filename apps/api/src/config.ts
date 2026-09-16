import { z } from 'zod';

/**
 * Environment configuration, validated once at startup ("fail fast").
 *
 * Every variable is documented in `.env.example` and
 * docs/development/environment.md. Error messages name the invalid variables
 * but never echo their values, because later variables will contain secrets.
 */
const environmentSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  HOST: z.string().trim().min(1).default('localhost'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3333),
});

export interface ApiConfig {
  readonly nodeEnv: 'development' | 'test' | 'production';
  readonly host: string;
  readonly port: number;
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

  return {
    nodeEnv: result.data.NODE_ENV,
    host: result.data.HOST,
    port: result.data.PORT,
  };
}
