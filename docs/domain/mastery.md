# Mastery

> Status: **implemented** (Phase 2). Code:
> [`mastery.ts`](../../libs/quiz/domain/src/lib/mastery.ts) (state machine) and
> [`progress.ts`](../../libs/quiz/domain/src/lib/progress.ts) (aggregation, rebuild, practice list).

Mastery is tracked per **user × category × country** (Capitals and Flags are
independent: knowing France's capital does not mean you recognise its flag).

## State

| Field       | Meaning                                              |
| ----------- | ---------------------------------------------------- |
| `points`    | Current mastery points (non-negative integer)        |
| `everWrong` | The item has been answered incorrectly at least once |
| `mastered`  | Derived: `points >= 3`                               |

## Transitions

| Event                             | Effect                           |
| --------------------------------- | -------------------------------- |
| Correct answer, **Easy**          | `points += 1`                    |
| Correct answer, **Hard**          | `points += 2`                    |
| Incorrect answer (any difficulty) | `points = 0`, `everWrong = true` |

An item is **mastered at 3 points**. A wrong answer after mastery removes
mastery, so progress reflects current knowledge.

## Derived concepts

- **Mistakes / practice candidates:** `everWrong && !mastered`. There is no
  separate mistakes table; the list is derived from the same state.
- **Region progress:** mastered items ÷ items in the region, computed from the dataset (never hard-coded counts).
- **Achievements:** e.g. "Europe Mastered" when every European country is mastered in a category.

## Why this rule

- **Resistant to luck:** in Easy mode a random guess is correct 25% of the time.
  Mastering by chance needs three consecutive lucky guesses (≈1.6%).
- **Rewards recall:** Hard mode requires producing the answer, so it counts double.
- **Deterministic:** replaying the same ordered answers always yields the same
  state, which the server relies on to rebuild progress when offline devices sync late.

## Examples

| Answers (in order)     | points | mastered | in mistakes |
| ---------------------- | ------ | -------- | ----------- |
| Easy ✓, Easy ✓, Easy ✓ | 3      | yes      | no          |
| Hard ✓, Easy ✓         | 3      | yes      | no          |
| Easy ✓, Easy ✓, Easy ✗ | 0      | no       | yes         |
| Easy ✗, Hard ✓, Hard ✓ | 4      | yes      | no          |

## Which answers count

Every recorded answer counts, whatever the mode: Fixed, Endless, Timed,
Practice Mistakes and leaderboard challenges. A correct answer in Practice
Mistakes is how a mistake gets fixed.

## Progress as a fold over events

Each answer becomes a `ProgressEvent` (category, country, difficulty, correct,
answer time, session id, position in session). Progress is the result of
applying events in order:

- `applyProgressEvents(progress, events)` appends new events on top of existing progress (client, after a session).
- `rebuildProgress(events)` sorts events canonically, by answer time, then
  session id, then position, and rebuilds from scratch.

Because the order is canonical, answers from two offline devices that sync
late in any order produce the **same** result. This is what the server relies
on in the synchronization phase.

## Practice Mistakes list

`practiceCandidates(dataset, progress, category)` returns every country with
`everWrong && !mastered`, **most recently answered first**, ties in dataset
order. An empty list drives the "No mistakes — great job!" empty state.

**Playing it** (Phase 10): Home shows a "Practise" button per category with
mistakes; the setup's fourth mode, _Practice mistakes_, counts them for the
chosen region. The quiz (`?mode=practice`) takes up to **20** of them — the
most recently missed first — when the round starts, and plays a Quick round
over exactly those countries (`countryCodes`), in the chosen difficulty. The
list is taken once per round, so answering does not change the questions.
A correct answer adds points as usual; a country leaves the list when it is
mastered again.
