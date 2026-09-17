# Scoring

> Status: **implemented** (Phase 2). Code:
> [`scoring.ts`](../../libs/quiz/domain/src/lib/scoring.ts).

A session's result is **derived only from its recorded answers**. There is no
stored "score" field that a client could set.

## Summary fields

| Field                              | Meaning                                                                                                           |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `totalQuestions`                   | Planned length (Fixed, Challenge); `null` for Endless and Timed                                                   |
| `answered`, `correct`, `incorrect` | Counts of recorded answers                                                                                        |
| `accuracy`                         | `correct / answered`, `0` if nothing was answered                                                                 |
| `durationMs`                       | `finishedAt − startedAt`; `null` while active. Timed sessions end at the deadline, so they are at most 60 000 ms. |
| `endReason`                        | `completed`, `stopped` or `time-up`                                                                               |
| `completed`                        | Every planned question was answered (never true for Endless/Timed)                                                |
| `perfect`                          | `completed` and zero incorrect answers                                                                            |
| `mistakes`                         | Countries answered wrong in this session, in order of first mistake                                               |

## How each mode presents the result

| Mode      | Headline                            | Example            |
| --------- | ----------------------------------- | ------------------ |
| Fixed     | `correct / totalQuestions`          | 9/10               |
| Endless   | `correct / answered`                | 23/27              |
| Timed     | `correct`                           | 17 correct answers |
| Challenge | completion time (only if `perfect`) | 6:42.310           |

Metrics are never compared across modes: a Timed count and a Fixed ratio
measure different things.

## Hard-mode typos

A typo accepted by [answer matching](answer-matching.md) counts as correct.
The record keeps `judgement: 'typo'` and the matched answer, so the UI can
show the correct spelling. No partial points are given.

## Personal records

Personal records exist only for the four leaderboard challenges (fastest
perfect run per board); see [leaderboard.md](leaderboard.md). Training sessions
produce summaries and update [mastery](mastery.md), but they do not create records.
