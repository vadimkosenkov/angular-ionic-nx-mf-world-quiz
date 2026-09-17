import { err, ok, type Result } from './result';

function parsePositive(value: number): Result<number, 'not-positive'> {
  return value > 0 ? ok(value) : err('not-positive');
}

describe('Result', () => {
  it('narrows to the value on success', () => {
    const result = parsePositive(3);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(3);
    }
  });

  it('narrows to the error on failure', () => {
    const result = parsePositive(-1);

    expect(result).toEqual({ ok: false, error: 'not-positive' });
  });
});
