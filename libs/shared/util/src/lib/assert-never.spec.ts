import { assertNever } from './assert-never';

describe('assertNever', () => {
  it('throws with the unexpected value in the message', () => {
    expect(() => assertNever('unknown-mode' as never)).toThrow(
      'Unexpected value: "unknown-mode"',
    );
  });

  it('supports a custom message', () => {
    expect(() => assertNever(42 as never, 'Unsupported mode')).toThrow(
      'Unsupported mode: 42',
    );
  });
});
