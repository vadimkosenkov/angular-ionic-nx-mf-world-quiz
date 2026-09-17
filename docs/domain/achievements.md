# Achievements

> Status: **implemented** (Phase 2, domain rules). UI in later phases. Code:
> [`achievements.ts`](../../libs/quiz/domain/src/lib/achievements.ts).

## Principle

Achievements represent **learning progress**, not activity. There are no
"played once" or "answered 10 questions" achievements, no streaks and no
currencies.

## Definitions

One achievement per **category × scope**, where scope is each of the six
regions plus World: **14 achievements**.

| Id                                                       | Unlocked when                                                     |
| -------------------------------------------------------- | ----------------------------------------------------------------- |
| `capitals-europe-mastered` … `capitals-oceania-mastered` | Every country of the region is [mastered](mastery.md) in Capitals |
| `capitals-world-mastered`                                | All 195 countries are mastered in Capitals                        |
| `flags-europe-mastered` … `flags-oceania-mastered`       | Same, for Flags                                                   |
| `flags-world-mastered`                                   | All 195 countries are mastered in Flags                           |

**Why separate Capitals and Flags:** they are different skills (the Figma
prototype also shows "Europe Mastered" and "European Flags" separately).
Combining them would hide progress; splitting further (by difficulty) would
inflate the list without adding meaning.

## States

| State         | Condition              | UI                              |
| ------------- | ---------------------- | ------------------------------- |
| `locked`      | 0 countries mastered   | muted card                      |
| `in-progress` | at least 1, not all    | progress bar `mastered / total` |
| `unlocked`    | all countries mastered | success card                    |

`total` always comes from the dataset (for example Europe = 44), never from a
hard-coded number. An achievement for an empty scope can never unlock.

Mastery can be lost (a wrong answer resets points), so an achievement's
**current state** can go back from unlocked to in-progress. Whether the app
keeps a permanent "unlocked once" badge is a presentation decision for the
achievements phase. If it does, the unlock time will be stored at that point.

## Unlock feedback

`newlyUnlockedAchievements(before, after)` compares two evaluations, for
example before and after applying a finished session, and returns the
achievements that just unlocked. The UI uses it for the celebration, sound and haptic.

## Offline

Achievements are computed locally from local progress, so they work offline.
After sync, the server's authoritative progress is re-evaluated with the same function.
