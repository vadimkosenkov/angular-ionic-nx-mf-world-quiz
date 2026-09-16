/**
 * Compile-time exhaustiveness check for discriminated unions.
 *
 * If a new member is added to a union (for example a new quiz mode) and a
 * `switch` does not handle it, the call to `assertNever` stops compiling.
 * At runtime it throws, which protects against untyped input.
 */
export function assertNever(value: never, message = 'Unexpected value'): never {
  throw new Error(`${message}: ${JSON.stringify(value)}`);
}
