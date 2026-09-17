/**
 * The shared vocabulary of World Quiz.
 *
 * These values are used by the Angular apps, the Express API, persisted data
 * and URLs, so they are defined once, as `readonly` tuples. The TypeScript
 * union types are derived from the tuples, which keeps the runtime list and
 * the compile-time type in sync automatically.
 *
 * Identifiers are stable, lowercase and kebab-case because they end up in
 * database rows, API payloads and deep links. User-facing labels are NOT
 * defined here; they belong to the i18n layer.
 */

/** Languages the app supports for UI text and for country/capital names. */
export const LOCALES = ['en', 'ru'] as const;
export type Locale = (typeof LOCALES)[number];

/** Question direction. Capitals: country → capital. Flags: flag → country. */
export const QUIZ_CATEGORIES = ['capitals', 'flags'] as const;
export type QuizCategory = (typeof QUIZ_CATEGORIES)[number];

/** Easy: pick one of four choices. Hard: type or dictate the answer. */
export const DIFFICULTIES = ['easy', 'hard'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

/**
 * Training modes are optimised for learning and are never ranked globally.
 * (The competitive "perfect run" challenge is a separate concept, see
 * `LEADERBOARD_BOARDS`.)
 */
export const TRAINING_MODES = ['fixed', 'endless', 'timed'] as const;
export type TrainingMode = (typeof TRAINING_MODES)[number];

/**
 * The competitive mode behind the global leaderboards: the complete World
 * country set, every answer must be correct, completion time is the score.
 */
export const CHALLENGE_MODE = 'challenge';
export type ChallengeMode = typeof CHALLENGE_MODE;

/** Every way a quiz session can be played. */
export const QUIZ_MODES = [...TRAINING_MODES, CHALLENGE_MODE] as const;
export type QuizMode = (typeof QUIZ_MODES)[number];

/** Default number of questions in Fixed mode. */
export const DEFAULT_FIXED_QUESTION_COUNT = 10;

/** Length of a Timed session. */
export const TIMED_MODE_DURATION_MS = 60_000;

/** Number of options (one correct + distractors) shown in Easy mode. */
export const EASY_CHOICE_COUNT = 4;

/** The geographic region a country is classified into. Every country has exactly one. */
export const REGIONS = [
  'europe',
  'asia',
  'africa',
  'north-america',
  'south-america',
  'oceania',
] as const;
export type Region = (typeof REGIONS)[number];

/**
 * UN M49 sub-regions, grouped into the app's six regions. The Americas are
 * split the way M49 groups them: Northern America, Central America and the
 * Caribbean form "North America"; South America stays on its own. Sub-regions
 * are used to pick plausible Easy-mode distractors (neighbours first).
 */
export const SUBREGIONS = {
  'northern-africa': 'africa',
  'eastern-africa': 'africa',
  'middle-africa': 'africa',
  'southern-africa': 'africa',
  'western-africa': 'africa',
  'northern-america': 'north-america',
  'central-america': 'north-america',
  caribbean: 'north-america',
  'south-america': 'south-america',
  'central-asia': 'asia',
  'eastern-asia': 'asia',
  'south-eastern-asia': 'asia',
  'southern-asia': 'asia',
  'western-asia': 'asia',
  'eastern-europe': 'europe',
  'northern-europe': 'europe',
  'southern-europe': 'europe',
  'western-europe': 'europe',
  'australia-and-new-zealand': 'oceania',
  melanesia: 'oceania',
  micronesia: 'oceania',
  polynesia: 'oceania',
} as const satisfies Readonly<Record<string, Region>>;
export type Subregion = keyof typeof SUBREGIONS;

/** What a quiz draws questions from: the whole world or a single region. */
export const QUIZ_SCOPES = ['world', ...REGIONS] as const;
export type QuizScope = (typeof QUIZ_SCOPES)[number];

export interface LeaderboardBoard {
  readonly id: `${QuizCategory}-${Difficulty}`;
  readonly category: QuizCategory;
  readonly difficulty: Difficulty;
  /** Leaderboard challenges always cover the complete World country set. */
  readonly scope: 'world';
}

/**
 * The global leaderboards: one per category × difficulty, exactly four.
 *
 * A board is a "perfect run" challenge: every country in the World scope must
 * be answered correctly and completion time is the ranking metric. Regions and
 * training modes intentionally do not create additional boards.
 */
export const LEADERBOARD_BOARDS: readonly LeaderboardBoard[] =
  QUIZ_CATEGORIES.flatMap((category) =>
    DIFFICULTIES.map((difficulty): LeaderboardBoard => ({
      id: `${category}-${difficulty}`,
      category,
      difficulty,
      scope: 'world',
    })),
  );

export type LeaderboardBoardId = LeaderboardBoard['id'];

/** The board a challenge run with this category and difficulty competes on. */
export function leaderboardBoardFor(
  category: QuizCategory,
  difficulty: Difficulty,
): LeaderboardBoard {
  const board = LEADERBOARD_BOARDS.find(
    (candidate) =>
      candidate.category === category && candidate.difficulty === difficulty,
  );
  if (!board) {
    throw new Error(`No leaderboard board for ${category}/${difficulty}`);
  }
  return board;
}

export const isLocale = createMembershipGuard(LOCALES);
export const isQuizCategory = createMembershipGuard(QUIZ_CATEGORIES);
export const isDifficulty = createMembershipGuard(DIFFICULTIES);
export const isTrainingMode = createMembershipGuard(TRAINING_MODES);
export const isQuizMode = createMembershipGuard(QUIZ_MODES);
export const isRegion = createMembershipGuard(REGIONS);
export const isSubregion = createMembershipGuard(
  Object.keys(SUBREGIONS) as Subregion[],
);
export const isQuizScope = createMembershipGuard(QUIZ_SCOPES);
export const isLeaderboardBoardId = createMembershipGuard(
  LEADERBOARD_BOARDS.map((board) => board.id),
);

/**
 * Builds a type guard for untrusted input (URL query params, API payloads,
 * persisted data) that narrows `unknown` to one of the allowed literals.
 */
function createMembershipGuard<const T extends string>(
  values: readonly T[],
): (value: unknown) => value is T {
  const allowed: ReadonlySet<string> = new Set(values);
  return (value: unknown): value is T =>
    typeof value === 'string' && allowed.has(value);
}
