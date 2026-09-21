import { z } from 'zod';

/** Epoch milliseconds, as produced by the domain's `Clock`. */
export const epochMillisSchema = z.int().nonnegative();

/**
 * A UUID, normalised to lower case. PostgreSQL stores and returns UUIDs in
 * lower case, so an id must hash, compare and appear in URLs the same way
 * whatever case the client wrote it in.
 */
export const uuidSchema = z.uuid().toLowerCase();

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
