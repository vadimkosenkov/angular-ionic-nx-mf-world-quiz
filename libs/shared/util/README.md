# shared-util

`@world-quiz/shared/util` · tags: `scope:shared`, `type:util`

Tiny, dependency-free helpers usable from every project (Angular apps, API,
domain). Same purity guards as `quiz-domain` (see its README). It must never
become a "misc" dumping ground: anything with product meaning belongs in a
domain library.

## Current contents

- `Clock`, `systemClock`, `createManualClock()` – time as an injectable
  dependency, so timing rules (Timed mode, completion time) are deterministic
  in tests.
- `assertNever()` – compile-time exhaustiveness checks for unions.

## Commands

```bash
npx nx test shared-util
npx nx typecheck shared-util
```
