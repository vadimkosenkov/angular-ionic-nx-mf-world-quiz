import {
  INVITE_CODE_ALPHABET,
  INVITE_CODE_LENGTH,
  normaliseInviteCode,
} from '@world-quiz/shared/contracts';
import { generateInviteCode } from './invite-code';

describe('generateInviteCode', () => {
  it('draws a code of the agreed length from the invite alphabet', () => {
    const code = generateInviteCode();

    expect(code).toHaveLength(INVITE_CODE_LENGTH);
    expect([...code].every((c) => INVITE_CODE_ALPHABET.includes(c))).toBe(true);
  });

  it('draws one character per position, in order', () => {
    const drawn = [1, 0, 2, 3, 4, 5, 6, 7];
    let index = 0;

    const code = generateInviteCode(() => drawn[index++]!);

    expect(code).toBe('10234567');
  });

  it('survives being read off a screen and typed back in', () => {
    // The code a player sees is already in the alphabet the normaliser
    // produces, so what they type can only come back as the same code.
    const code = generateInviteCode();

    expect(normaliseInviteCode(code.toLowerCase())).toBe(code);
  });

  it('does not repeat itself', () => {
    const codes = new Set(
      Array.from({ length: 200 }, () => generateInviteCode()),
    );

    expect(codes.size).toBe(200);
  });
});
