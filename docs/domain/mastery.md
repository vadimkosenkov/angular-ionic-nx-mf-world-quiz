# Mastery

> Status: **rules approved** (Phase 0). Implemented in Phase 2
> (`feat/domain-model`) as a pure, deterministic state machine in `quiz-domain`.

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
