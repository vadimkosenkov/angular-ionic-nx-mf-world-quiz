# Leaderboard: perfect-run challenges

> Status: **domain rules implemented** (Phase 2):
> [`leaderboard.ts`](../../libs/quiz/domain/src/lib/leaderboard.ts) —
> `evaluateChallengeRun`, `compareLeaderboardEntries`, `rankLeaderboard`,
> `personalBests`, `isNewPersonalRecord`; challenge mode in the
> [quiz engine](quiz-engine.md). **Server implemented** (Phase 9a): issued
> challenges with a server seed, the timing check, ranked runs, public
> boards and personal records ([backend.md](../architecture/backend.md#leaderboards-challenges-and-records)).
> 📐 Playing challenges and the leaderboard screen in the app (Phase 9b), the
> public leaderboard on the SSR site (Phase 9c).

## Concept

The global leaderboard is **not** a statistics board. It is a dedicated
competitive challenge: **answer every country in the World scope correctly, as
fast as possible.** Training modes (Fixed, Endless, Timed, Practice Mistakes)
exist for learning and never submit to the leaderboard.

## Boards

Exactly four boards, one per category × difficulty:

| Board id        | Question                                  | Challenge length  |
| --------------- | ----------------------------------------- | ----------------- |
| `capitals-easy` | Country → pick the capital from 4 choices | all 195 countries |
| `capitals-hard` | Country → type/dictate the capital        | all 195 countries |
| `flags-easy`    | Flag → pick the country from 4 choices    | all 195 countries |
| `flags-hard`    | Flag → type/dictate the country           | all 195 countries |

There are no regional boards and no boards for Timed/Endless/Fixed/Practice.
A unit test in `quiz-domain` asserts exactly these four ids.

## Eligibility

`evaluateChallengeRun(session, summary, dataset)` returns
`{ eligible: true, board, completionTimeMs }` or a reason:
`not-a-challenge`, `not-finished`, `incomplete`, `has-incorrect-answers`,
`invalid-question-set`. The server calls it on the session **it replayed
itself** from the uploaded record ([quiz-engine.md](quiz-engine.md#determinism-seeds)).

A run is ranked only if **all** of the following hold:

1. It is a leaderboard challenge run for one of the four boards (not a training session).
2. The question set is the **complete World country set** (deterministic count for the board).
3. **Every** question was answered, and **every** answer is correct (100%, zero incorrect answers).
4. The run was completed, not abandoned.
5. The server's validation succeeds (see below).

Any incorrect answer makes the run ineligible. Abandoned or incomplete runs are never ranked.

## Ranking

1. **Primary:** completion time, ascending (faster is better).
2. **Tie-breaks:** the earlier server-recorded time (`recordedAt`, when the
   server accepted the run), then the entry id. The order is total, so ranks
   are unique and stable. Implemented in `compareLeaderboardEntries` and covered by tests.

Each user appears **once per board** with their best eligible run (their
personal record, `personalBests`). A new personal record must be **strictly**
faster than the previous best (`isNewPersonalRecord`). The UI separates **Global Leaderboard** from **My Records**.

## Comparability: server-issued challenges

Runs on the same board are comparable because every challenge uses the same
deterministic rules for question set, order and (for Easy) choice generation
— with a seed **the server issues**:

1. `POST /v1/challenges {board}` creates a challenge: an id, 128 random bits
   of seed, the server's issue time; it expires after **3 hours**.
2. The app plays the World set with exactly that seed and sends the session
   with `challengeId`.
3. The server checks that the challenge is the player's, unplayed, for this
   board and this seed, replays the session, and decides whether it is
   ranked. A challenge is played once; another session for it is refused.

A player may start as many challenges as they like; only their best ranked
run per board counts.

## Timing

The time that ranks is the run's **own**: from the first question to the last
answer, measured on the device. It is precise and does not depend on the
network. The server checks it against what it saw itself — the **window**
from issuing the challenge to receiving the result:

| Check                                          | If it fails        |
| ---------------------------------------------- | ------------------ |
| window ≤ 3 hours                               | `expired`          |
| run time ≤ window + 2 s (clock drift)          | `implausible-time` |
| window − run time ≤ 60 s (loading and sending) | `late`             |

So a client cannot claim to be faster by more than 60 seconds, and a result
that was not sent right after the run (played offline, kept in the outbox) is
recorded for progress but **not ranked**: challenges are played online.
Implemented in `apps/api/src/leaderboard/challenge-rules.ts`.

## Trust model

- The server calculates eligibility and completion time. The client never
  provides rank, score or user id as facts.
- The server re-checks every answer with the shared `quiz-domain` matching rules.
- Honest limitation: a scripted client that knows the answers can still submit
  a perfect run, and can shave up to the 60-second tolerance off its time.
  The server-issued seed, one run per challenge, the lifetime and the timing
  window raise the bar but do not make the system cheat-proof; per-answer
  timing bounds are not checked yet. This is documented, not hidden.

## Public names

Boards are public (also on the SSR site), so a player appears under a
**nickname** they choose in the app (`PATCH /v1/me`: 3–24 letters, digits,
spaces, `_`, `-`, `.`). Until then it is a stable default derived from the
account id, such as "Player 4821". The name and e-mail from Google or Apple
are never shown. Nicknames are not unique; players are told apart by their
account, which the public API never reveals.

## Performance

**Query-based** (Phase 9a): each player's best ranked run (`DISTINCT ON`),
numbered with `row_number()` in the order of `compareLeaderboardEntries`,
over a partial index on ranked runs `(board, completion_ms, recorded_at,
session_id)`. A test checks the SQL ranking against `rankLeaderboard` on
generated runs with ties. Introduce a dedicated projection **only** if
measurements show the query is too slow.
