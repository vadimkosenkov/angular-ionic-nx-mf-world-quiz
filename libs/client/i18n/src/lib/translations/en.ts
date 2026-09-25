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
    practice: 'Practice mistakes',
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
  welcome: {
    tagline: 'Master every capital and flag',
    intro:
      'Sign in to play. Your progress is saved to your account and follows you to every device.',
    stats: {
      countries: {
        one: 'Country',
        few: 'Countries',
        many: 'Countries',
        other: 'Countries',
      },
      regions: {
        one: 'Region',
        few: 'Regions',
        many: 'Regions',
        other: 'Regions',
      },
      modes: { one: 'Mode', few: 'Modes', many: 'Modes', other: 'Modes' },
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
    online:
      'Play it online: the time counts from the first question to the last answer, and the result must reach the server right away.',
    start: 'Start challenge · {{board}}',
    startFailed:
      'The challenge could not be started. Check your connection and try again.',
    loading: 'Loading the leaderboard…',
    loadFailed: {
      title: 'The leaderboard cannot be loaded',
      message: 'Rankings need a connection to the World Quiz server.',
    },
    retry: 'Try again',
    empty: {
      title: 'No perfect runs yet',
      message: 'Be the first on this board.',
    },
    you: '(you)',
    players: {
      one: '{{count}} player ranked',
      few: '{{count}} players ranked',
      many: '{{count}} players ranked',
      other: '{{count}} players ranked',
    },
    place: '#{{rank}} of {{players}}',
    noRecord: 'No perfect run yet',
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
    howItWorks:
      'A country is mastered when you answer that same country correctly three times in a row — twice in Hard mode. A wrong answer starts it over. The achievement opens once every country of the region is mastered.',
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
      practice: 'Countries to review: {{mistakes}}',
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
  practice: {
    emptyTitle: 'Nothing to review',
    empty:
      'No mistakes left here — every country you missed is mastered again.',
    start: 'Practise',
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
    newChallenge: 'New challenge',
    challenge: {
      title: 'Leaderboard',
      checking: 'Checking your run with the server…',
      unsent:
        'Not sent: you are offline. The run is saved and will be sent later, but challenges sent late are not ranked.',
      ranked: 'Ranked #{{rank}}',
      time: 'Time: {{time}}',
      record: 'New personal record!',
      reasons: {
        'not-finished': 'Not ranked: the run was not finished.',
        incomplete: 'Not ranked: every country must be answered.',
        'has-incorrect-answers': 'Not ranked: every answer must be correct.',
        'invalid-question-set':
          'Not ranked: the run did not cover the whole world.',
        expired: 'Not ranked: the challenge expired before the result arrived.',
        late: 'Not ranked: the result reached the server too long after the run.',
        'implausible-time':
          'Not ranked: the run took longer than the server allows for it.',
      },
    },
  },
  settings: {
    title: 'Settings',
    account: {
      title: 'Account',
      checking: 'Checking your sign-in…',
      unverified:
        'The World Quiz server cannot be reached, so your sign-in cannot be checked. It is checked again when you are back online.',
      retry: 'Try again',
      googleUnavailable:
        'Google sign-in is unavailable right now. Check your connection or content blocker, then reload.',
      appleOnIos: 'Sign in with Apple arrives with the iPhone app.',
      signInWithGoogle: 'Sign in with Google',
      signInNotConfigured:
        'This build of the app has no Google sign-in configured, so it cannot sign you in.',
      devSignIn: 'Development sign-in',
      appleLater:
        'Sign in with Apple needs an Apple Developer account and comes later.',
      player: 'Player',
      signedInWith: 'Signed in with {{provider}}',
      providers: {
        google: 'Google',
        apple: 'Apple',
        dev: 'a development account',
      },
      sync: {
        saved: 'All your results are saved to your account.',
        saving: 'Saving your results…',
        pending: {
          one: '{{count}} result is waiting to be saved to your account.',
          few: '{{count}} results are waiting to be saved to your account.',
          many: '{{count}} results are waiting to be saved to your account.',
          other: '{{count}} results are waiting to be saved to your account.',
        },
        rejected: {
          one: '{{count}} result could not be verified by the server and was not saved to your account.',
          few: '{{count}} results could not be verified by the server and were not saved to your account.',
          many: '{{count}} results could not be verified by the server and were not saved to your account.',
          other:
            '{{count}} results could not be verified by the server and were not saved to your account.',
        },
        offline:
          'No connection to the World Quiz server; saving is retried automatically.',
      },
      nickname: {
        label: 'Public name',
        edit: 'Change',
        save: 'Save name',
        rules:
          'Shown on leaderboards instead of your name: 3 to 24 letters, digits, spaces, "_", "-" or ".".',
      },
      signOut: 'Sign out',
      delete: 'Delete account',
      deleteTitle: 'Delete your account?',
      deleteText:
        'Your account and everything stored with it on our server are deleted permanently. This cannot be undone.',
      deleteConfirm: 'Delete permanently',
      cancel: 'Cancel',
      signOutPendingTitle: 'Sign out without saving?',
      signOutPendingText: {
        one: '{{count}} result played on this device has not been saved to your account yet. Signing out deletes it from this device.',
        few: '{{count}} results played on this device have not been saved to your account yet. Signing out deletes them from this device.',
        many: '{{count}} results played on this device have not been saved to your account yet. Signing out deletes them from this device.',
        other:
          '{{count}} results played on this device have not been saved to your account yet. Signing out deletes them from this device.',
      },
      signOutAnyway: 'Sign out anyway',
      staySignedIn: 'Stay signed in',
      errors: {
        'sign-in-failed': 'Sign-in did not work. Please try again.',
        unreachable:
          'The World Quiz server cannot be reached. Check your connection.',
        'delete-failed': 'Your account could not be deleted. Please try again.',
        'nickname-invalid': 'This name is not allowed. Check the rules below.',
        'nickname-failed': 'The name could not be saved. Please try again.',
      },
    },
    appearance: {
      title: 'Appearance',
      light: 'Light',
      dark: 'Dark',
      system: 'System',
    },
    feel: {
      title: 'Sound and feel',
      sound: 'Sounds',
      haptics: 'Vibration',
      hint: 'Short tones when an answer lands and when a round ends.',
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
