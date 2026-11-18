# ADR-015: Friends are found by an invite code, and show each other what the boards already show

## Status

Accepted (2026-11-18), the API implemented in Phase 27a (`feat/friends-server`),
the screens in Phase 27b.

## Context

Every board is global: 56 rankings of everybody who plays. A player who is
#248 of 400 has nothing to compare with somebody they know, and the one
social thing the app does — a shared result picture (Phase 26) — ends in
whatever chat the player pasted it into.

What a "friends" feature needs is decided by three questions:

1. **How is another player found?** The app has nicknames (public, 3–24
   characters, chosen freely) and no email directory. Nicknames are not
   unique and were never meant to be an address.
2. **What does being friends grant?** A board is the natural answer; a
   profile is the question behind it ("who is this and what have they done?").
3. **Who agrees to it?** A connection that one side can make alone is a
   follow; one both sides make is a friendship.

## Decision

- **An invite code, handed over by its owner.** Every account carries one
  permanent code of 8 characters in Crockford's base32 (no `I`, `L`, `O`,
  `U` — 32^8 ≈ 10^12 codes). There is **no directory and no search**: a
  player who has not given their code out cannot be found at all, by anyone.
  What the client types is normalised back into the alphabet
  (`normaliseInviteCode`): case is ignored, spaces and dashes are dropped,
  and `I`/`L` read as `1`, `O` as `0`.
- **The code is permanent.** Rotating it would break every invite link
  already sent, and the worst a leaked code can do is put a stranger in a
  list the player must accept.
- **Friendship is mutual.** A request is one row, and only the addressee can
  accept it. Asking somebody who has already asked you accepts their request
  instead of adding a second one. Declining and unfriending are the same
  act — the row goes — so there is **no block list**: a player who was
  removed can ask again, and a player who does not want to be asked never
  hands their code out.
- **A friend sees what the public boards already show, plus achievements.**
  Nickname, best run per board, and the achievements (learning progress).
  Not: the history of play, the mistakes, the email, the provider name, or
  when they last played.
- **The friends board is the same ranking, narrowed.** `GET
/v1/friends/leaderboards/:board` runs the public board's query over the
  player and their friends, numbering places from 1 — one query, one index,
  56 boards, as before (ADR-014).
- **A friend's achievements are computed on the server** from the stored
  answers, with the same domain functions the device uses
  (`rebuildProgress` + `evaluateAchievements`). Nothing about mastery is
  stored: it is derived on both sides, and a stored copy would drift the
  first time the rules change.
- **404, not 403**, for a player who is not a friend: whether an id exists
  is itself private, and a 403 would turn the endpoint into a way of testing
  ids.

## Alternatives

| Alternative                                         | Why not                                                                                                                               |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **Search by nickname**                              | Nicknames are not unique and not an address; a searchable directory makes every player findable by strangers, which nobody asked for  |
| **Follow, like a social network**                   | One-sided: it hands a stranger your records without your answer. A friendship is two people agreeing, which is what a shared board is |
| **Unique nicknames as the address**                 | Turns a display name into an identifier — first-come-first-served, squatting, renaming breaks links — for no gain over a code         |
| **One-time or rotating invite codes**               | Every invite already sent dies with the rotation, and the threat it protects against is a request the player can decline              |
| **A block list**                                    | A list of enemies to maintain, for a case the invite code already answers: nobody can ask who was never given the code                |
| **Share the achievements the device already knows** | The device holds only its own player's progress. A friend's achievements exist only where their sessions are: on the server           |
| **Store each player's mastery in a table**          | A second source of truth that drifts the moment the mastery rules change; the answers are already stored and replaying them is cheap  |

## Consequences

- A player's record on a friends board is a different number from the same
  run's place on the public board. Both are shown, because they answer
  different questions.
- The friends board is only as interesting as a player's friends list, and an
  empty list is the normal state of a new account — so the screens must say
  what a code is for rather than show an empty table (Phase 27b).
- Achievements cost a read of every answer a friend has ever given. It is one
  indexed query and the profile is opened by hand, so it is cheap today; if a
  player with years of history makes it slow, the fix is a cached projection
  invalidated by a new session, not a stored mastery table.
- A deleted account disappears from every friends list by itself: the rows
  cascade with the user (ADR-010).
- There is no notion of a "friend request from a stranger" to moderate,
  because a stranger cannot ask: they would need a code that was handed to
  them.
