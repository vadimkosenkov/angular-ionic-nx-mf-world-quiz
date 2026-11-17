# ADR-014: Leaderboards are fed by ordinary games, not by server-issued challenges

## Status

Accepted (2026-11-17), implemented in Phase 25 (`feat/ranked-boards-server`).
Supersedes the leaderboard design of Phase 9a/9b.

## Context

Phase 9 shipped four boards — one per category × difficulty — and one way to
reach them: `POST /v1/challenges` issued a challenge with a server seed, the
app played **all 195 countries** with that seed, and only such a run was
ranked. The seed made runs comparable and the window between "issued" and
"received" let the server bound the claimed time.

Playing it showed what the design cost:

- A ranked run was a **15-to-30-minute** commitment nobody made twice. The
  boards stayed empty while people played quick rounds all day — and those
  runs could never count for anything.
- Four boards for a game whose setup asks four questions. A player who had
  just played capitals of Europe on Hard had no board of their own.
- The leaderboard screen's main control started a _different_ game from the
  one the player knew, in a mode that existed only here.
- Results played offline were recorded but never ranked, because the timing
  window had already closed — the sync was built to be patient and the board
  was not.

## Decision

- A board is **the four settings a quiz is played with**: category × region ×
  difficulty × ranked mode — 56 boards. Ranked modes are the quick round
  (ranked by time) and the time attack (ranked by correct answers, the run's
  own time as the tie-break). Endless and Practice Mistakes have no board.
- **Any game competes.** The client sends the session it played, as it
  already did for progress; the API replays it, decides with
  `evaluateRankedRun` whether it belongs on a board, and answers with the
  place it earned. `POST /v1/challenges` and the `challenge` mode are gone,
  and with them the `challenges` table.
- **Every run draws its own seed**, so no two players are asked the same
  questions. The app says so on the setup screen and on the board.
- One wrong answer disqualifies a run, as before. The board stays "flawless
  runs only".
- The player's own row is **pinned under the ranking** and highlighted in
  place, so a board is worth opening from #248.
- Records from the old design are dropped: the table went with the feature,
  and a time over 195 countries cannot be compared with a quick round.

## Alternatives

| Alternative                                         | Why not                                                                                                                                 |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **Keep challenges, add a short one**                | Still a separate game started from one screen, and the whole point was that the game people already play should count                   |
| **One seed per board** (everyone gets the same ten) | It must come from the server, which is what makes a board unreachable from ordinary play; and the questions are then learnable by heart |
| **One seed per board per day**                      | Same server round trip, plus a board that resets daily — a bigger feature (seasons) than this phase, and worth doing on top of this one |
| **Rank by score, not by flawlessness**              | Then every run ranks and the board becomes a play-count table; "flawless" is the thing worth being proud of                             |
| **Keep the timing window and refuse late results**  | Offline play is a feature (ADR-006); a board that refuses what the outbox carries punishes the player for the network                   |

## Consequences

- The boards fill from day one, and a player can see the effect of the run
  they just played.
- **Less can be proven about a time.** There is no issued-to-received window,
  so the server only refuses the impossible: under 250 ms per answered
  question (`MIN_RANKED_ANSWER_MS`). A scripted client can claim any time
  above the floor. This is written down here, in
  [leaderboard.md](../domain/leaderboard.md) and in
  [security.md](../architecture/security.md) rather than implied to be safe.
  If it is ever abused, the shape of the fix is per-answer timing bounds and
  a server seed for a _separate_ "official" board, not a return to this one.
- Luck enters the ranking: a kind draw of ten countries is faster than a
  cruel one. Accepted, and said on screen — over a board's lifetime a player
  who keeps playing keeps their best run, and the alternative costs more.
- 56 boards cannot be a list of links. They are chosen with the same four
  controls as the quiz setup (the app) and four groups of one-setting-at-a-time
  links (the site, which keeps every board a real, crawlable URL).
- One table (`leaderboard_runs`), one ascending `rank_key` from
  `rankingKey()`, one index for all 56 boards.
