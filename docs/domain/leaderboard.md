# Leaderboard: perfect-run challenges

> Status: **rules approved** (Phase 0). The board vocabulary exists in
> `quiz-domain` (`LEADERBOARD_BOARDS`). Challenge flow, server validation and
> ranking queries are implemented in Phase 9 (`feat/leaderboard-records`).

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

A run is ranked only if **all** of the following hold:

1. It is a leaderboard challenge run for one of the four boards (not a training session).
2. The question set is the **complete World country set** (deterministic count for the board).
3. **Every** question was answered, and **every** answer is correct (100%, zero incorrect answers).
4. The run was completed, not abandoned.
5. The server's validation succeeds (see below).

Any incorrect answer makes the run ineligible. Abandoned or incomplete runs are never ranked.

## Ranking

1. **Primary:** completion time, ascending (faster is better).
2. **Tie-break:** a deterministic server-side criterion: the more precise
   server-measured duration, then the earlier server-recorded completion
   timestamp, then a stable id. The exact order is fixed in Phase 9 and covered by tests.

Each user appears **once per board** with their best eligible run (their
personal record). The UI separates **Global Leaderboard** from **My Records**.

## Comparability

Runs on the same board must be comparable, so the challenge uses the same
deterministic rules for question set, order and (for Easy) choice generation.
Phase 9 decides how the server issues and later verifies this (for example a
server-issued challenge id and seed) and how it measures duration.

## Trust model

- The server calculates eligibility and completion time. The client never
  provides rank, score or user id as facts.
- The server re-checks every answer with the shared `quiz-domain` matching rules.
- Honest limitation: a scripted client that knows the answers can still submit
  a perfect run. Plausibility checks (per-answer timing bounds, ordering,
  challenge lifetime) raise the bar but do not make the system cheat-proof. This
  is documented, not hidden.

## Performance

Start with a **query-based** approach: best eligible run per user per board,
using an index that matches the ranking order. Introduce a dedicated
records/leaderboard projection **only** if measurements show the query is too slow.
