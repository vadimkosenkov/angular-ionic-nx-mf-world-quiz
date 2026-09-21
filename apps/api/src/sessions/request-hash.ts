import { createHash } from 'node:crypto';

/**
 * JSON with object keys sorted at every level, so two requests that carry the
 * same data produce the same text whatever order the client wrote keys in.
 */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(',')}]`;
  }
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value)
      .filter(([, entry]) => entry !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`);
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value);
}

/**
 * SHA-256 of the canonical JSON of a request body.
 *
 * It is computed from the request as parsed by the contract, so key order,
 * `undefined` values and the case of the id do not matter. The flip side:
 * whatever the parser adds is hashed too. A new request field with a
 * `.default()` would change the hash of every retry from an older client and
 * turn it into a 409. Add request fields without defaults, or plan how stored
 * hashes are recomputed.
 */
export function requestHash(body: unknown): string {
  return createHash('sha256').update(canonicalJson(body)).digest('hex');
}
