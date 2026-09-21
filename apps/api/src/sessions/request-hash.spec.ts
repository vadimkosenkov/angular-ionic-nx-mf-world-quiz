import { canonicalJson, requestHash } from './request-hash';

describe('canonicalJson', () => {
  it('sorts keys at every level and keeps array order', () => {
    expect(canonicalJson({ b: 1, a: { d: [2, 1], c: null } })).toBe(
      '{"a":{"c":null,"d":[2,1]},"b":1}',
    );
  });

  it('ignores undefined properties, like JSON does', () => {
    expect(canonicalJson({ a: 1, b: undefined })).toBe('{"a":1}');
  });
});

describe('requestHash', () => {
  it('is the same for the same data in any key order', () => {
    expect(requestHash({ a: 1, b: [1, 2] })).toBe(
      requestHash({ b: [1, 2], a: 1 }),
    );
  });

  it('changes with the data', () => {
    expect(requestHash({ a: 1 })).not.toBe(requestHash({ a: 2 }));
    expect(requestHash({ a: [1, 2] })).not.toBe(requestHash({ a: [2, 1] }));
  });
});
