import {
  INVITE_CODE_ALPHABET,
  INVITE_CODE_LENGTH,
} from '@world-quiz/shared/contracts';
import { randomInt } from 'node:crypto';

/**
 * A player's invite code.
 *
 * It is the only way to be found, so it has to survive being read off one
 * screen and typed into another: the alphabet is Crockford's base32 (no
 * `I`, `L`, `O` or `U`), and the client normalises what was typed back into
 * it (`normaliseInviteCode` in the contracts).
 *
 * Eight characters are 32^8 ≈ 10^12 codes. Guessing one is pointless — the
 * worst a guess can do is send a stranger's request into a list the player
 * has to accept — but a short code would still be rude to the player whose
 * code was guessed, and a longer one would be rude to type.
 */
export function generateInviteCode(
  random: (exclusiveMax: number) => number = (max) => randomInt(max),
): string {
  let code = '';
  for (let index = 0; index < INVITE_CODE_LENGTH; index += 1) {
    code += INVITE_CODE_ALPHABET[random(INVITE_CODE_ALPHABET.length)];
  }
  return code;
}
