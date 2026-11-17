# Leaderboard: boards fed by ordinary games

> Status: **implemented** (Phase 25, [ADR-014](../decisions/ADR-014-ranked-boards.md)).
> Domain: [`leaderboard.ts`](../../libs/quiz/domain/src/lib/leaderboard.ts) —
> `evaluateRankedRun`, `rankingKey`, `compareLeaderboardEntries`,
> `rankLeaderboard`, `personalBests`, `isNewPersonalRecord`; the 56 boards are
> `LEADERBOARD_BOARDS` in
> [`vocabulary.ts`](../../libs/quiz/domain/src/lib/vocabulary.ts). API: ranked
> runs, public boards and personal records
> ([backend.md](../architecture/backend.md#leaderboards-ranked-runs-and-records)).
> App: the board picker, the ranking with the player's own row, My records and
> the verdict on the results screen
> ([frontend.md](../architecture/frontend.md#leaderboard-boards-rankings-records)).
> Public site: the same boards, server-rendered ([site.md](../architecture/site.md)).

## Concept

A board is **the four settings a quiz is played with** — category, region,
difficulty and mode — and any game in one of the two ranked modes competes on
the board of its own settings. Nothing is started from the Leaderboard tab:
the player simply plays, and the API answers the finished session with the
place it earned.

This is the opposite of the earlier design, where the server issued a
195-country "challenge" with its own seed and only such a run could rank. Why
it changed is [ADR-014](../decisions/ADR-014-ranked-boards.md); in
short, a board nobody can reach by playing is a board nobody reaches.

## Boards

56 of them: 2 categories × 7 regions (the world and its six regions) ×
2 difficulties × 2 ranked modes. The id is those four values in that order,
e.g. `capitals-easy-world-fixed` or `flags-hard-europe-timed`. A unit test
asserts the set and that `leaderboardBoardFor` and `leaderboardBoardById`
agree with it.

| Ranked mode           | What the mode holds fixed | What the board ranks (`metric`)          |
| --------------------- | ------------------------- | ---------------------------------------- |
| `fixed` (quick round) | ten questions             | `time` — the run's own time, ascending   |
| `timed` (time attack) | sixty seconds             | `correct` — how many answers, descending |

Endless has no end to compare, and Practice Mistakes asks a set only one
player is asked, so neither has a board.

### One ranking key for both metrics

A board ranks by the lowest time or by the highest count, but there is one
table, one `ORDER BY` and one index for all 56. `rankingKey(score, metric)`
turns a score into a single **ascending** key: the time itself, or the
negated count. The server stores it beside the score (`rank_key`), so SQL
never has to know which metric a board uses.

## Eligibility

`evaluateRankedRun(session, summary)` returns
`{ eligible: true, board, score }` or `{ eligible: false, reason }`:

| Reason                  | Meaning                                                       |
| ----------------------- | ------------------------------------------------------------- |
| `not-a-ranked-mode`     | Endless, or a mode that is not played for a board             |
| `not-finished`          | Abandoned, or still running                                   |
| `chosen-countries`      | The questions were picked for this player (Practice Mistakes) |
| `has-incorrect-answers` | One wrong answer is enough                                    |
| `non-standard-length`   | A quick round that was not ten questions (`?count=`)          |
| `incomplete`            | A quick round that did not reach its last question            |
| `no-answers`            | A time attack where nothing was answered                      |

The score is `{ value, timeMs }`: `value` is what the board ranks by, and
`timeMs` is always the run's own length — the score on a `time` board, and
the tie-break on a `correct` one, where two players who reached the same
number are separated by who got there first.

The server calls this on the session **it replayed itself** from the uploaded
record ([quiz-engine.md](quiz-engine.md#determinism-seeds)), so no number the
client sent about its own performance is trusted.

## Ranking

1. **Primary:** the ranking key, ascending.
2. **Tie-breaks:** the run's own time, then the server's `recordedAt`, then
   the entry id. The order is total, so ranks are unique and stable
   (`compareLeaderboardEntries`).

Each player appears **once per board**, with their best run (`personalBests`);
a new personal record must be strictly better (`isNewPersonalRecord`, which
compares by the same key). Because ranks are unique, the app can mark the
player's own row by rank alone and never has to compare nicknames.

## Luck is part of it, and the screen says so

Every run draws its own seed, so two players are never asked the same ten
countries. The quiz setup and the Leaderboard tab both say so plainly
("Every run draws its own questions"). A shared seed per board was the
alternative and was rejected: it would have to come from the server, which
is exactly what makes a board unreachable from ordinary play, and a player
who has seen the board's ten countries once would then have them for good.

## What the server can and cannot check

Without a server-issued seed there is no window between "issued" and
"received" to measure a run against, and runs played offline must still rank
once they sync — so there is no lateness check and no `expired`. What is left:

- The server **re-grades** every answer with `quiz-domain` from the run's own
  seed. A run that cannot be replayed is rejected outright (422), not corrected.
- It refuses an **impossible** time: a run shorter than
  `MIN_RANKED_ANSWER_MS` (250 ms) per answered question is a forged payload,
  not a fast player. Such a run is recorded for progress but not ranked.
- One run is one row; the player's best per board is a query, not a stored
  "record" a client could overwrite.

Honest limitation: a scripted client that knows the answers can submit a
flawless run and claim any time at or above the floor. The trade-off is
written down in [ADR-014](../decisions/ADR-014-ranked-boards.md)
and in [security.md](../architecture/security.md). Per-answer timing bounds
are not checked.

## Public names

Boards are public (also on the SSR site), so a player appears under a
**nickname** they choose in the app (`PATCH /v1/me`: 3–24 letters, digits,
spaces, `_`, `-`, `.`). Until then it is a stable default derived from the
account id, such as "Player 4821". The name and e-mail from Google or Apple
are never shown. Nicknames are not unique; players are told apart by their
account, which the public API never reveals.

## Performance

**Query-based**: each player's best ranked run (`DISTINCT ON (board,
user_id)`), numbered with `row_number()` in `compareLeaderboardEntries`
order, over an index on `(board, user_id, rank_key, time_ms, recorded_at,
session_id)`. A test checks the SQL ranking against `rankLeaderboard` on
generated runs with ties. Introduce a dedicated projection **only** if
measurements show the query is too slow.
