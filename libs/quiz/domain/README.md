# quiz-domain

`@world-quiz/quiz/domain` · tags: `scope:shared`, `type:domain`

The platform-independent heart of World Quiz. It will contain the quiz engine,
answer normalization and matching, scoring, mastery, achievements and
leaderboard ranking rules. The **same code runs in the Angular apps and in the
Express API**, so the server can re-validate results instead of trusting the
client.

## Current contents (foundation)

- `vocabulary.ts` – categories, difficulties, training modes, regions, quiz
  scopes and the four leaderboard boards, with type guards for untrusted input.

## Purity rules (enforced, not just documented)

| Guard                                                     | What it rejects                                                                           |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `tsconfig.lib.json` → `lib: ["es2022"]`, `types: []`      | DOM globals (`window`, `document`) and Node globals (`process`, `Buffer`) fail to compile |
| `@nx/enforce-module-boundaries` → `bannedExternalImports` | `@angular/*`, `@ionic/*`, `@capacitor/*`, `rxjs`, `express`, `zod`, ORM/storage packages  |
| `no-restricted-imports` / `no-restricted-globals`         | `node:*` and bare Node built-ins, browser/Node globals                                    |
| Tag rules                                                 | may depend only on `type:domain` and `type:util` libraries                                |

If a rule needs time, randomness or storage, inject an abstraction (for example
`Clock` from `@world-quiz/shared/util`).

## Commands

```bash
npx nx test quiz-domain
npx nx typecheck quiz-domain
npx nx lint quiz-domain
```
