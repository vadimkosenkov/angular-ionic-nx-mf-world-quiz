# quiz-domain

`@world-quiz/quiz/domain` · tags: `scope:shared`, `type:domain`

The platform-independent heart of World Quiz. It will contain the quiz engine,
answer normalization and matching, scoring, mastery, achievements and
leaderboard ranking rules. The **same code runs in the Angular apps and in the
Express API**, so the server can re-validate results instead of trusting the
client.

## Contents

| Module                      | Responsibility                                                                                                     | Docs                                                                 |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| `vocabulary.ts`             | Categories, difficulties, modes, locales, regions and UN M49 sub-regions, the four leaderboard boards, type guards | —                                                                    |
| `country.ts`                | `Country` model, scope filtering, display/accepted answers, dataset validation                                     | [countries](../../../docs/domain/countries.md)                       |
| `random.ts`                 | Seeded PRNG, derived seeds, shuffling                                                                              | [quiz engine](../../../docs/domain/quiz-engine.md#determinism-seeds) |
| `answer-matching.ts`        | Normalization, bounded edit distance, typo tolerance, ambiguity guard                                              | [answer matching](../../../docs/domain/answer-matching.md)           |
| `questions.ts`              | Deterministic question order and Easy-mode choices                                                                 | [quiz engine](../../../docs/domain/quiz-engine.md)                   |
| `session.ts`                | Immutable session engine for Fixed/Endless/Timed/Challenge, grading, server replay                                 | [quiz engine](../../../docs/domain/quiz-engine.md)                   |
| `scoring.ts`                | Session summary                                                                                                    | [scoring](../../../docs/domain/scoring.md)                           |
| `mastery.ts`, `progress.ts` | Mastery state machine, progress fold/rebuild, region progress, practice list                                       | [mastery](../../../docs/domain/mastery.md)                           |
| `achievements.ts`           | 14 mastery achievements and unlock detection                                                                       | [achievements](../../../docs/domain/achievements.md)                 |
| `leaderboard.ts`            | Challenge eligibility, ranking, personal bests                                                                     | [leaderboard](../../../docs/domain/leaderboard.md)                   |

The dataset is **not** imported here; pass it in:

```ts
import { COUNTRIES } from '@world-quiz/quiz/countries';
import { createQuizEngine } from '@world-quiz/quiz/domain';

const engine = createQuizEngine(COUNTRIES);
const started = engine.start({ category: 'capitals', difficulty: 'hard', mode: 'timed', scope: 'europe' }, { seed: crypto.randomUUID(), startedAt: now() });
```

Tests use `src/testing/fixture-dataset.ts`, a small dataset with look-alike countries.

## Purity rules (enforced, not just documented)

| Guard                                                     | What it rejects                                                                           |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `tsconfig.lib.json` → `lib: ["es2022"]`, `types: []`      | DOM globals (`window`, `document`) and Node globals (`process`, `Buffer`) fail to compile |
| `@nx/enforce-module-boundaries` → `bannedExternalImports` | `@angular/*`, `@ionic/*`, `@capacitor/*`, `rxjs`, `express`, `zod`, ORM/storage packages  |
| `no-restricted-imports` / `no-restricted-globals`         | `node:*` and bare Node built-ins, browser/Node globals                                    |
| Tag rules                                                 | may depend only on `type:domain` and `type:util` libraries                                |

If a rule needs time, randomness or storage, it receives it as a parameter:
timestamps are arguments, randomness comes from a seed, the dataset is passed in.

## Commands

```bash
npx nx test quiz-domain
npx nx typecheck quiz-domain
npx nx lint quiz-domain
```
