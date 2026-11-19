import type { Locale } from '@world-quiz/quiz/domain';

/**
 * What a friend's row shows instead of a picture.
 *
 * There are no avatars in this app — the only name a player has is their
 * nickname — so a row leads with its first character. `Intl` is not needed
 * here beyond the upper case: the nickname may be in any script, and
 * whatever its first character is, is what the player sees on the boards.
 */
export function friendInitial(nickname: string): string {
  return [...nickname.trim()][0]?.toLocaleUpperCase() ?? '?';
}

/**
 * The day a friendship started, or a request was sent, as the language
 * writes a date.
 *
 * Unlike a release (a calendar day read as UTC), this is a moment the
 * server recorded, so it is formatted in the device's own zone: it is the
 * player's "when", not the server's.
 */
export function friendSince(since: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(
    new Date(since),
  );
}
