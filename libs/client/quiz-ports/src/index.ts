export {
  CLOCK,
  COUNTRY_DATASET,
  QUIZ_PROGRESS_READER,
  QUIZ_RESULT_SINK,
} from './lib/quiz-ports';
export type {
  QuizProgressReader,
  QuizRemoteRoutesModule,
  QuizResultSink,
  QuizSessionContext,
  QuizSessionOutcome,
} from './lib/quiz-ports';
export {
  InMemoryQuizPorts,
  provideInMemoryQuizPorts,
} from './lib/in-memory-quiz-ports';
