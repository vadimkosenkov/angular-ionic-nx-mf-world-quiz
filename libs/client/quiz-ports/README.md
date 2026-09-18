# client-quiz-ports

`@world-quiz/client/quiz-ports` · tags: `scope:client`, `type:ports`

The contract between the shell (host) and the quiz microfrontends (remotes):

| Token                  | Purpose                                                                                               |
| ---------------------- | ----------------------------------------------------------------------------------------------------- |
| `COUNTRY_DATASET`      | The country dataset (overridable in tests and previews)                                               |
| `CLOCK`                | Monotonic wall clock used for quiz timing                                                             |
| `QUIZ_RESULT_SINK`     | Where a remote submits a finished session; returns the outcome (new achievements, remaining mistakes) |
| `QUIZ_PROGRESS_READER` | Read-only progress for setup screens and Practice Mistakes                                            |

Remotes only depend on these interfaces, never on the shell. The shell
provides the implementations on the federated route.

Documentation: [docs/architecture/microfrontends.md](../../../docs/architecture/microfrontends.md)
