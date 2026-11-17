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

/** Every way a quiz session can be played. */
export const QUIZ_MODES = ['fixed', 'endless', 'timed'] as const;
export type QuizMode = (typeof QUIZ_MODES)[number];

/**
 * The modes a public board ranks (docs/domain/leaderboard.md). A run in one
 * of them competes by being flawless; Endless has no end to compare and
 * Practice Mistakes asks a set only one player has.
 */
export const RANKED_MODES = ['fixed', 'timed'] as const;
export type RankedMode = (typeof RANKED_MODES)[number];

/**
 * What a board ranks by. A quick round is a fixed number of questions, so
 * the time it took is the score; a timed round is a fixed amount of time,
 * so how far the player got in it is the score.
 */
export const LEADERBOARD_METRICS = { fixed: 'time', timed: 'correct' } as const;
export type LeaderboardMetric =
  (typeof LEADERBOARD_METRICS)[keyof typeof LEADERBOARD_METRICS];

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
  readonly id: `${QuizCategory}-${Difficulty}-${QuizScope}-${RankedMode}`;
  readonly category: QuizCategory;
  readonly difficulty: Difficulty;
  readonly scope: QuizScope;
  readonly mode: RankedMode;
  readonly metric: LeaderboardMetric;
}

/**
 * The public boards: one per category × difficulty × scope × ranked mode,
 * 56 of them.
 *
 * A board is a question ("the capitals of Europe, typed, in a quick round")
 * and one way to answer it well. The four dimensions are the four choices
 * the quiz setup already asks for, so a player who has just played knows
 * exactly which board their run went to.
 */
export const LEADERBOARD_BOARDS: readonly LeaderboardBoard[] =
  QUIZ_CATEGORIES.flatMap((category) =>
    DIFFICULTIES.flatMap((difficulty) =>
      QUIZ_SCOPES.flatMap((scope) =>
        RANKED_MODES.map((mode): LeaderboardBoard => ({
          id: `${category}-${difficulty}-${scope}-${mode}`,
          category,
          difficulty,
          scope,
          mode,
          metric: LEADERBOARD_METRICS[mode],
        })),
      ),
    ),
  );

export type LeaderboardBoardId = LeaderboardBoard['id'];

/** The board with this id. */
export function leaderboardBoardById(id: LeaderboardBoardId): LeaderboardBoard {
  const board = LEADERBOARD_BOARDS.find((candidate) => candidate.id === id);
  if (!board) throw new Error(`No leaderboard board ${id}`);
  return board;
}

/** The board a run with these four choices competes on. */
export function leaderboardBoardFor(
  category: QuizCategory,
  difficulty: Difficulty,
  scope: QuizScope,
  mode: RankedMode,
): LeaderboardBoard {
  const board = LEADERBOARD_BOARDS.find(
    (candidate) =>
      candidate.category === category &&
      candidate.difficulty === difficulty &&
      candidate.scope === scope &&
      candidate.mode === mode,
  );
  if (!board) {
    throw new Error(
      `No leaderboard board for ${category}/${difficulty}/${scope}/${mode}`,
    );
  }
  return board;
}

export const isLocale = createMembershipGuard(LOCALES);
export const isQuizCategory = createMembershipGuard(QUIZ_CATEGORIES);
export const isDifficulty = createMembershipGuard(DIFFICULTIES);
export const isQuizMode = createMembershipGuard(QUIZ_MODES);
export const isRankedMode = createMembershipGuard(RANKED_MODES);
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
