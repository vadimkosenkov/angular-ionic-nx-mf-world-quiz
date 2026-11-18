// Vocabulary
export {
  DEFAULT_FIXED_QUESTION_COUNT,
  DIFFICULTIES,
  EASY_CHOICE_COUNT,
  isDifficulty,
  isLeaderboardBoardId,
  isLocale,
  isQuizCategory,
  isQuizMode,
  isRankedMode,
  isQuizScope,
  isRegion,
  isSubregion,
  LEADERBOARD_BOARDS,
  LEADERBOARD_METRICS,
  RANKED_MODES,
  leaderboardBoardById,
  leaderboardBoardFor,
  LOCALES,
  QUIZ_CATEGORIES,
  QUIZ_MODES,
  QUIZ_SCOPES,
  REGIONS,
  SUBREGIONS,
  TIMED_MODE_DURATION_MS,
} from './lib/vocabulary';
export type {
  Difficulty,
  LeaderboardBoard,
  LeaderboardBoardId,
  LeaderboardMetric,
  Locale,
  QuizCategory,
  QuizMode,
  RankedMode,
  QuizScope,
  Region,
  Subregion,
} from './lib/vocabulary';

// Countries
export {
  acceptedAnswers,
  countriesInScope,
  displayAnswer,
  indexCountriesByCode,
  validateDataset,
} from './lib/country';
export type {
  Country,
  CountryCode,
  CountryDataset,
  DatasetIssue,
  LocalizedAliases,
  LocalizedText,
} from './lib/country';

// Randomness
export {
  createSeededRandom,
  deriveSeed,
  randomInt,
  shuffled,
} from './lib/random';
export type { RandomSource } from './lib/random';

// Answer matching
export {
  boundedEditDistance,
  buildAnswerIndex,
  matchAnswer,
  normalizeAnswer,
  typoTolerance,
} from './lib/answer-matching';
export type {
  AnswerIndex,
  AnswerIndexEntry,
  AnswerMatch,
} from './lib/answer-matching';

// Questions and sessions
export { createQuestionSource, generateChoices } from './lib/questions';
export type {
  QuestionSource,
  QuestionSourceOptions,
  QuizQuestion,
} from './lib/questions';
export { createQuizEngine, gradeAnswer } from './lib/session';
export type {
  AnswerJudgement,
  AnswerRecord,
  GradedAnswer,
  QuizConfig,
  QuizConfigError,
  QuizEngine,
  QuizSession,
  ReplayError,
  SessionEndReason,
  SessionRecord,
  SubmitError,
  SubmitResult,
  SubmittedAnswer,
} from './lib/session';
export { summarizeSession } from './lib/scoring';
export type { SessionSummary } from './lib/scoring';

// Mastery and progress
export {
  applyMasteryAnswer,
  INITIAL_MASTERY,
  isMastered,
  isMistake,
  MASTERY_POINTS,
  MASTERY_THRESHOLD,
} from './lib/mastery';
export type { MasteryAnswer, MasteryState } from './lib/mastery';
export {
  applyProgressEvents,
  compareProgressEvents,
  masteryOf,
  practiceCandidates,
  progressByScope,
  progressKey,
  rebuildProgress,
  scopeProgress,
  sessionProgressEvents,
} from './lib/progress';
export type {
  ProgressEvent,
  ProgressKey,
  ProgressMap,
  ScopeProgress,
} from './lib/progress';

// Achievements
export {
  ACHIEVEMENTS,
  evaluateAchievements,
  newlyUnlockedAchievements,
} from './lib/achievements';
export type {
  AchievementDefinition,
  AchievementId,
  AchievementProgress,
  AchievementStatus,
} from './lib/achievements';

// Leaderboard
export {
  compareLeaderboardEntries,
  evaluateRankedRun,
  formatRunTime,
  isNewPersonalRecord,
  leaderboardMetricOf,
  personalBests,
  rankingKey,
  rankLeaderboard,
} from './lib/leaderboard';
export type {
  LeaderboardEntry,
  RankedLeaderboardEntry,
  RankedScore,
  RunEvaluation,
  RunIneligibility,
} from './lib/leaderboard';
