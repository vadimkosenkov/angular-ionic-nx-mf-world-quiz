/**
 * English UI texts. This file defines the translation key structure; every
 * other language must provide exactly the same keys (enforced by the
 * `TranslationShape` type and by a unit test).
 *
 * Conventions:
 * - Keys are grouped by screen, then by element.
 * - `{{name}}` placeholders are filled by Transloco.
 * - Countable phrases have `one` / `few` / `many` / `other` forms, selected
 *   with `Intl.PluralRules` (see `PluralPipe`). English only uses `one` and
 *   `other`, but all four keys exist so every language has the same shape.
 * - Country and capital names are NOT here: they come from the dataset.
 */
export const en = {
  app: {
    name: 'World Quiz',
  },
  common: {
    progressValue: '{{value}} of {{max}}',
  },
  tabs: {
    label: 'Main navigation',
    home: 'Home',
    leaderboard: 'Leaderboard',
    achievements: 'Achievements',
    settings: 'Settings',
  },
  categories: {
    capitals: 'Capitals',
    flags: 'Flags',
  },
  difficulty: {
    easy: 'Easy',
    hard: 'Hard',
  },
  modes: {
    fixed: 'Quick round',
    endless: 'Endless',
    timed: 'Time attack',
  },
  regions: {
    world: 'World',
    europe: 'Europe',
    asia: 'Asia',
    africa: 'Africa',
    'north-america': 'North America',
    'south-america': 'South America',
    oceania: 'Oceania',
  },
  counts: {
    countries: {
      one: '{{count}} country',
      few: '{{count}} countries',
      many: '{{count}} countries',
      other: '{{count}} countries',
    },
    mistakes: {
      one: '{{count}} country to review',
      few: '{{count}} countries to review',
      many: '{{count}} countries to review',
      other: '{{count}} countries to review',
    },
    regions: {
      one: '{{count}} region',
      few: '{{count}} regions',
      many: '{{count}} regions',
      other: '{{count}} regions',
    },
  },
  home: {
    greeting: {
      morning: 'Good morning',
      afternoon: 'Good afternoon',
      evening: 'Good evening',
      night: 'Good night',
    },
    subtitle: 'Ready to explore the world?',
    progress: {
      title: 'Overall progress',
      caption: 'Capitals and flags mastered',
      percent: '{{percent}}% complete',
    },
    categories: {
      title: 'Choose a category',
      capitals: {
        title: 'Country → Capital',
        description: 'Name the capital of each country',
      },
      flags: {
        title: 'Flag → Country',
        description: 'Recognize every country by its flag',
      },
    },
    practice: {
      title: 'Practice mistakes',
      emptyTitle: 'All clear',
      empty: 'No mistakes yet. They will appear here to review.',
    },
    achievements: {
      title: 'Achievements',
      seeAll: 'See all',
    },
  },
  leaderboard: {
    title: 'Leaderboard',
    views: {
      global: 'Global',
      mine: 'My records',
    },
    boardsLabel: 'Leaderboard category',
    boards: {
      'capitals-easy': 'Capitals · Easy',
      'capitals-hard': 'Capitals · Hard',
      'flags-easy': 'Flags · Easy',
      'flags-hard': 'Flags · Hard',
    },
    rules:
      'Answer all {{count}} countries correctly. The fastest perfect run wins.',
    unavailable: {
      title: 'Leaderboards are on their way',
      message:
        'Global rankings and personal records will appear here once sign-in and syncing are available.',
    },
  },
  achievements: {
    title: 'Achievements',
    summary: '{{unlocked}}/{{total}} unlocked',
    percent: '{{percent}}%',
    statuses: {
      unlocked: 'Unlocked',
      'in-progress': 'In progress',
      locked: 'Locked',
    },
    name: {
      capitals: '{{scope}} · Capitals',
      flags: '{{scope}} · Flags',
    },
    progress: '{{mastered}}/{{total}} mastered',
  },
  setup: {
    title: 'Quiz setup',
    category: 'Quiz type',
    scope: 'Region',
    difficulty: 'Difficulty',
    difficultyHint: {
      easy: 'Pick from four possible answers',
      hard: 'Type or dictate the answer',
    },
    mode: 'Game mode',
    modeHint: {
      fixed: '{{count}} questions',
      endless: 'Play until you stop',
      timed: '60 seconds',
    },
    start: 'Start quiz',
    play: 'Start',
  },
  quiz: {
    exit: 'Leave quiz',
    progress: 'Question {{position}} of {{total}}',
    progressEndless: 'Question {{position}}',
    score: 'Score',
    timeLeft: 'Time left',
    prompt: {
      capitals: 'What is the capital?',
      flags: 'Which country does this flag belong to?',
    },
    flagLabel: 'Flag of the country in question',
    answerLabel: 'Your answer',
    answerPlaceholder: {
      capitals: 'Capital city',
      flags: 'Country name',
    },
    check: 'Check',
    emptyAnswer: 'Type an answer first',
    correct: 'Correct',
    incorrect: 'Not quite',
    accepted: 'Accepted as {{answer}}',
    correctAnswer: 'Correct answer',
    continue: 'Continue',
    finish: 'Finish',
    finishEarly: 'Finish quiz',
    unavailable: {
      title: 'Quiz unavailable',
      message:
        'This quiz could not be loaded. Check your connection and try again.',
      back: 'Back to home',
    },
  },
  results: {
    title: 'Results',
    perfect: 'Perfect run!',
    correctOf: '{{correct}} of {{answered}} correct',
    accuracy: 'Accuracy',
    time: 'Time',
    unlocked: 'Achievements unlocked',
    review: 'To review',
    playAgain: 'Play again',
    backHome: 'Back to home',
  },
  settings: {
    title: 'Settings',
    appearance: {
      title: 'Appearance',
      light: 'Light',
      dark: 'Dark',
      system: 'System',
    },
    language: {
      title: 'Language',
      en: 'English',
      ru: 'Russian',
    },
    about: {
      title: 'About',
      version: 'Version',
      data: 'Country data',
      dataValue: 'Wikidata, UN M49',
      flags: 'Flags',
      flagsValue: 'flag-icons (MIT)',
    },
  },
} as const;

/** The structure every translation must match: same keys, string leaves. */
export type TranslationShape<T = typeof en> = {
  readonly [K in keyof T]: T[K] extends string
    ? string
    : TranslationShape<T[K]>;
};
