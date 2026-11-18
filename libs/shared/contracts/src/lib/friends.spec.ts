import {
  friendRequestBodySchema,
  INVITE_CODE_LENGTH,
  inviteCodeSchema,
  normaliseInviteCode,
} from './friends';

describe('invite codes', () => {
  describe('normaliseInviteCode', () => {
    it('reads a code typed in lower case', () => {
      expect(normaliseInviteCode('abcd1234')).toBe('ABCD1234');
    });

    it('drops the spaces and dashes people break a code up with', () => {
      expect(normaliseInviteCode(' ABCD-1234 ')).toBe('ABCD1234');
    });

    it('reads the letters nobody can tell from digits as the digits', () => {
      // Crockford's own rule: the alphabet has no I, L, O or U, so a player
      // who types what the shape of the character suggests is still right.
      expect(normaliseInviteCode('IL0OZZZZ')).toBe('1100ZZZZ');
      expect(normaliseInviteCode('iloZZZZZ')).toBe('110ZZZZZ');
    });
  });

  describe('inviteCodeSchema', () => {
    it('accepts a code as the player typed it', () => {
      expect(inviteCodeSchema.parse('abcd-1234')).toBe('ABCD1234');
    });

    it('refuses a code of the wrong length', () => {
      expect(inviteCodeSchema.safeParse('ABCD123').success).toBe(false);
      expect(inviteCodeSchema.safeParse('ABCD12345').success).toBe(false);
    });

    it('refuses a character the alphabet does not have', () => {
      expect(inviteCodeSchema.safeParse('ABCD123!').success).toBe(false);
      expect(inviteCodeSchema.safeParse('UUUUUUUU').success).toBe(false);
    });

    it('refuses a code long enough to be an attack on the normaliser', () => {
      expect(
        inviteCodeSchema.safeParse('-'.repeat(1000) + 'ABCD1234').success,
      ).toBe(false);
    });

    it('is the only field a request carries', () => {
      expect(
        friendRequestBodySchema.safeParse({
          code: 'ABCD1234',
          friend: 'somebody-else',
        }).success,
      ).toBe(false);
      expect(friendRequestBodySchema.parse({ code: 'ABCD1234' })).toEqual({
        code: 'ABCD1234',
      });
    });

    it('agrees with the length the code is drawn to', () => {
      expect('ABCD1234'.length).toBe(INVITE_CODE_LENGTH);
    });
  });
});
