import { z } from 'zod';

/** Epoch milliseconds, as produced by the domain's `Clock`. */
export const epochMillisSchema = z.int().nonnegative();

/** Lowercase ISO 3166-1 alpha-2 code, e.g. `fr`. */
export const countryCodeSchema = z.string().regex(/^[a-z]{2}$/);

/**
 * RFC 9457 problem details, the body of every error response
 * (`Content-Type: application/problem+json`).
 */
export const problemDetailsSchema = z.object({
  type: z.string(),
  title: z.string(),
  status: z.int(),
  detail: z.string().optional(),
  /** Validation errors: where in the request body, and what is wrong. */
  errors: z
    .array(z.object({ path: z.string(), message: z.string() }))
    .optional(),
});

export type ProblemDetails = z.infer<typeof problemDetailsSchema>;
