/**
 * The public name of a player who has not chosen one: "Player" and four
 * digits derived from the user id. Stable, so a player keeps it until they
 * pick their own; not unique (players are told apart by id, never by name).
 */
export function defaultNickname(userId: string): string {
  const number = Number.parseInt(userId.replaceAll('-', '').slice(0, 8), 16);
  return `Player ${1000 + (number % 9000)}`;
}
