# shared-contracts

The HTTP contract of the World Quiz API as [Zod](https://zod.dev) schemas:
request bodies, response bodies and the problem-details error format.

- The **API** parses every request body with these schemas, so a request that
  does not match is rejected before any business logic runs.
- The **client** (from the offline-sync phase) builds its requests from the
  same types, so both sides fail at compile time when the contract changes.

Pure TypeScript (`scope:shared`, `type:contracts`): no Angular, Node or DOM.
Values that come from the quiz domain (categories, modes, regions) are taken
from `@world-quiz/quiz/domain`, never repeated here.
