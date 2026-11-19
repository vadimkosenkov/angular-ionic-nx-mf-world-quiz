import { friendInitial, friendSince } from './friend-rows';

describe('friendInitial', () => {
  it('is the first character of the nickname, in upper case', () => {
    expect(friendInitial('ann the explorer')).toBe('A');
    expect(friendInitial('  Boris')).toBe('B');
  });

  it('works in any script, and on a character outside the basic plane', () => {
    // A nickname is whatever the player typed; the boards show it as it is.
    expect(friendInitial('Мария')).toBe('М');
    // Spread by code point, so a surrogate pair stays one character
    // instead of coming out as half of one.
    const sunflower = String.fromCodePoint(0x1f33b);
    expect(friendInitial(`${sunflower}player`)).toBe(sunflower);
  });

  it('has something to show for a name of nothing', () => {
    expect(friendInitial('   ')).toBe('?');
  });
});

describe('friendSince', () => {
  it('writes the day the way the language does', () => {
    const since = '2026-11-18T10:00:00.000Z';

    expect(friendSince(since, 'en')).toBe('Nov 18, 2026');
    expect(friendSince(since, 'ru')).toBe('18 нояб. 2026 г.');
  });
});
