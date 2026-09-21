import type { ProblemDetails } from '@world-quiz/shared/contracts';
import type { Response } from 'express';
import type { ZodError } from 'zod';

/**
 * Sends an RFC 9457 problem-details response. Every error the API returns
 * has this shape, so clients handle failures in one place.
 */
export function sendProblem(
  response: Response,
  problem: Omit<ProblemDetails, 'type'> & { type?: string },
): void {
  response
    .status(problem.status)
    .type('application/problem+json')
    .json({ type: 'about:blank', ...problem });
}

/** Zod issues as `{ path, message }`, e.g. `submissions.0.answer.text`. */
export function validationErrors(error: ZodError): ProblemDetails['errors'] {
  return error.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
  }));
}
