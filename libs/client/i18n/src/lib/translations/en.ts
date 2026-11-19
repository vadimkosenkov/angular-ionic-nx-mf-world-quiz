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
    close: 'Close',
    cancel: 'Cancel',
  },
  // The app's one transient message (see `Toasts`); the texts it shows come
  // from the screen that asked for it.
  toast: {
    dismiss: 'Close message',
  },
  // The bell on Home: what the app has to say, as opposed to the outcome of
  // something the player just did (that is a toast).
  notifications: {
    title: 'Messages',
    label: 'Messages',
    labelUnread: 'Messages, one unread',
    empty: 'Nothing new right now.',
    friends: {
      title: {
        one: '{{count}} friend request',
        few: '{{count}} friend requests',
        many: '{{count}} friend requests',
        other: '{{count}} friend requests',
      },
      action: 'See who is waiting',
    },
    release: {
      title: 'Update {{version}}',
      action: 'See what changed',
    },
  },
  releaseNotes: {
    title: "What's new",
    version: 'Version {{version}}',
    empty:
      'The notes start with the next update: nothing was written down before this screen existed.',
  },
  tabs: {
    label: 'Main navigation',
    home: 'Home',
    leaderboard: 'Leaderboard',
    achievements: 'Achievements',
    settings: 'Settings',
  },
  tips: {
    step: 'Step {{current}} of {{total}}',
    next: 'Next',
    gotIt: 'Got it',
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
  nav: {
    back: 'Back',
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
    friends: {
      one: '{{count}} friend',
      few: '{{count}} friends',
      many: '{{count}} friends',
      other: '{{count}} friends',
    },
    friendRequests: {
      one: '{{count}} request waiting',
      few: '{{count}} requests waiting',
      many: '{{count}} requests waiting',
      other: '{{count}} requests waiting',
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
    play: {
      title: 'Play',
      quiz: {
        title: 'Quiz',
        open: 'Play',
      },
    },
    practice: {
      title: 'Practice mistakes',
      emptyTitle: 'All clear',
      empty: 'No mistakes yet. They will appear here to review.',
    },
    learn: {
      title: 'Learn',
      countries: {
        title: 'Countries',
        description: 'Every country with its capital and its flag',
        open: 'Browse',
      },
    },
    friends: {
      kind: 'Together',
      description: 'Compare your records with the people you know',
    },
    achievements: {
      title: 'Achievements',
      seeAll: 'See all',
    },
  },
  countries: {
    title: 'Countries',
    region: 'Region',
    legend: 'A capital or a flag gets a green tick once you have mastered it.',
    flagOf: 'Flag of {{country}}',
    mark: {
      capitals: {
        known: 'Capital: mastered',
        unknown: 'Capital: not mastered yet',
      },
      flags: {
        known: 'Flag: mastered',
        unknown: 'Flag: not mastered yet',
      },
    },
  },
  leaderboard: {
    title: 'Leaderboards',
    views: {
      global: 'Board',
      mine: 'My records',
    },
    // The four settings a board stands for, assembled from the names the
    // quiz setup already uses for them.
    boardName: '{{category}} · {{region}} · {{difficulty}} · {{mode}}',
    // The same four settings in the ranking dialog, as two deliberate
    // lines: what is asked and where, then how it is played. On a phone
    // the one line wrapped after the third setting, which reads as an
    // accident; these two are a grouping.
    boardTitle: 'Leaderboard',
    boardSubject: '{{category}} · {{region}}',
    boardStyle: '{{difficulty}} · {{mode}}',
    // What a board asks of a player, in the words they would use
    // themselves. "Ranked by the time the ten questions took" is a
    // description of a SQL order, not an invitation to play.
    metric: {
      fixed:
        'Answer {{count}} random questions correctly, faster than anyone else.',
      timed: 'Answer as many questions correctly as you can in 60 seconds.',
    },
    show: 'Show the board',
    close: 'Close',
    loading: 'Loading the leaderboard…',
    loadFailed: {
      title: 'The leaderboard cannot be loaded',
      message: 'Rankings need a connection to the World Quiz server.',
    },
    retry: 'Try again',
    empty: {
      title: 'No flawless runs yet',
      message: 'Be the first on this board.',
      friends:
        'Nobody you know is on this board yet. Hand your code to somebody.',
    },
    you: '(you)',
    players: {
      one: '{{count}} player ranked',
      few: '{{count}} players ranked',
      many: '{{count}} players ranked',
      other: '{{count}} players ranked',
    },
    place: '#{{rank}} of {{players}}',
    correct: '{{correct}} correct',
    audience: {
      label: 'Who is on this board',
      everyone: 'Everyone',
      friends: 'Friends',
    },
    rank: '#{{rank}}',
    noRecords: {
      title: 'No records yet',
      message: 'Play a quick round or a time attack without a single mistake.',
    },
  },
  // Friends: found only by the code a player hands over themselves, and
  // never by searching for them (ADR-015).
  friends: {
    title: 'Friends',
    open: 'Open',
    failed: 'That did not work. Try again.',
    offline: {
      title: 'Your friends cannot be loaded',
      message:
        'The list lives on the World Quiz server; this needs a connection.',
      retry: 'Try again',
    },
    empty: {
      title: 'Nobody here yet',
      message:
        'Give your code to somebody you know, or type in theirs. You will then share a board.',
    },
    invite: {
      action: 'Invite a friend',
      title: 'Invite a friend',
      explain:
        'They scan the code, open the link, or type the eight characters.',
      qrLabel: 'A QR code of your invite link',
      share: 'Share the invite',
      copied: 'The invite is copied.',
      message: 'Play World Quiz with me.',
      code: 'My code: {{code}}',
      landing: 'One moment…',
    },
    add: {
      label: "Have somebody else's code?",
      placeholder: 'Their code',
      action: 'Add',
      sent: 'Asked {{name}} to be friends.',
      accepted: 'You and {{name}} are friends now.',
      error: {
        'invalid-code': 'A code is eight characters, like K7M2 X4PQ.',
        self: 'That code is yours. Give it to somebody else.',
        'unknown-code': 'Nobody holds that code. Check the characters.',
        failed: 'The request could not be sent. Try again.',
      },
    },
    requests: {
      title: 'Waiting for you',
      note: 'wants to be friends',
      accept: 'Accept',
      decline: 'Say no to {{name}}',
      accepted: 'You and {{name}} are friends now.',
      declined: 'Request removed.',
    },
    list: {
      title: 'Friends',
      since: 'friends since {{date}}',
    },
    sent: {
      title: 'Asked',
      note: 'asked on {{date}}',
      cancel: 'Take back the request to {{name}}',
    },
    one: {
      title: 'Friend',
      since: 'Friends since {{date}}',
      records: 'Their records',
      achievements: 'What they have learned',
      noRecords: {
        title: 'No records yet',
        message: 'They have not finished a flawless ranked run.',
      },
      gone: {
        title: 'This page is not yours to see',
        message:
          'You are not friends any more, or the player has left. Your own friends are on the previous screen.',
      },
    },
    remove: {
      action: 'Remove friend',
      title: 'Remove {{name}}?',
      text: 'You will both lose the shared board. They are not told, and you can ask each other again later.',
      confirm: 'Remove',
      done: '{{name}} is no longer a friend.',
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
    howItWorks:
      'A country is mastered when you answer that same country correctly three times in a row — twice in Hard mode. A wrong answer starts it over. The achievement opens once every country of the region is mastered.',
  },
  setup: {
    title: 'Quiz setup',
    category: 'Quiz type',
    categories: {
      capitals: 'Name the capital of each country',
      flags: 'Recognize every country by its flag',
    },
    scope: 'Region',
    difficulty: 'Difficulty',
    difficultyHint: {
      easy: 'Pick from four possible answers',
      hard: 'Type or dictate the answer',
    },
    mode: 'Game mode',
    modeInfo:
      'Quick round and Time attack are ranked.\n\nEndless and Practice mistakes are for learning only.',
    modeInfoLabel: 'About the game modes',
    // The mark on the two modes that play against everyone else. It sits
    // on the row rather than over a group of rows.
    rankedBadge: 'Ranked',
    modeHint: {
      fixed: '{{count}} questions',
      endless: 'Play until you stop',
      timed: '60 seconds',
      practice: 'Countries to review: {{mistakes}}',
    },
    start: 'Start quiz',
    play: 'Start',
    // The guided tour of this screen, one step per choice, shown once.
    tour: {
      category: 'Start with the quiz type: capitals, or flags.',
      scope: 'Now the region — the whole world, or one part of it.',
      difficulty:
        'Then the difficulty: pick from four answers, or type the answer yourself.',
      mode: 'Last, the game mode: a set round, endless, or against the clock.',
    },
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
    yourAnswer: 'Your answer',
    tapToContinue: 'Tap to continue',
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
    board: {
      title: 'Leaderboard',
      checking: 'Checking the board…',
      unsent:
        'Not on the board yet: you are offline. The run is saved and reaches the board with the next sync.',
      ranked: '#{{rank}} of {{players}}',
      time: 'Time: {{time}}',
      correct: '{{correct}} correct in {{time}}',
      // The two figures a record card shows under its headline.
      place: 'Place',
      answers: 'Correct',
      record: 'New personal record!',
    },
  },
  share: {
    // The sheet's own heading; some targets use it as the subject line.
    title: 'World Quiz',
    action: 'Share the result',
    /**
     * What the picture leads with, in the player's own voice; the rule that
     * picks one is `shareClaim` in `client/ui`.
     */
    claim: {
      record: 'New personal record!',
      first: "I'm #1 on the board!",
      topThree: "I'm in the top three!",
      ranked: "I'm on the leaderboard!",
      perfect: 'A flawless run!',
      plain: 'My World Quiz result',
    },
    /** The invitation at the foot of every picture. */
    beatMe: 'Beat my result',
    /** A board this player is alone on, where "#1 of 1" is no boast. */
    firstOnBoard: 'First result on this board',
    result: {
      heading: 'World Quiz — {{category}}, {{region}}, {{difficulty}}',
      // The picture's band already says World Quiz, so the card names only
      // what was played.
      subject: '{{category}} · {{region}} · {{difficulty}}',
      score: '{{correct}}/{{answered}} correct · {{accuracy}}% · {{time}}',
    },
    record: {
      action: 'Share the {{board}} record',
      score: '{{score}} · {{place}}',
    },
    copied: 'Copied — paste it wherever you like.',
    failed: 'This browser can neither share nor copy the result.',
  },
  settings: {
    title: 'Settings',
    /** The "i" beside a setting: "About Sounds". */
    info: 'About {{name}}',
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
        // Said once the connection is back and the waiting results are in.
        caughtUp: {
          one: 'Back online: {{count}} result is saved to your account.',
          few: 'Back online: {{count}} results are saved to your account.',
          many: 'Back online: {{count}} results are saved to your account.',
          other: 'Back online: {{count}} results are saved to your account.',
        },
      },
      nickname: {
        label: 'Public name',
        edit: 'Change',
        save: 'Save',
        saved: 'Your public name is saved.',
        // What the name is for. The rules are not repeated here: they are
        // the error under the field, and nowhere else.
        about: 'This is how other players see you on the leaderboards.',
        invalid:
          'That name will not do: 3 to 24 letters, digits, spaces, "_", "-" or ".".',
      },
      signOut: 'Sign out',
      delete: 'Delete account',
      deleteTitle: 'Delete your account?',
      deleteText:
        'Your account and everything stored with it on our server are deleted permanently. This cannot be undone.',
      deleteConfirm: 'Delete permanently',
      deleteHint: 'Press and hold until the bar is full.',
      deleteRehearsal: 'Delete permanently (rehearsal)',
      deleteRehearsalHint: 'Rehearsal: nothing is deleted.',
      cancel: 'Cancel',
      signOutTitle: 'Sign out?',
      signOutText:
        'The results of this account are deleted from this device. They stay in the account, and signing in again brings them back.',
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
      signedOut: 'You are signed out.',
      deleted: 'Your account and its results are deleted.',
      errors: {
        'sign-in-failed': 'Sign-in did not work. Please try again.',
        unreachable:
          'The World Quiz server cannot be reached. Check your connection.',
        'delete-failed': 'Your account could not be deleted. Please try again.',
        'nickname-invalid': 'This name is not allowed.',
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
      // Deliberately names no screen: which presses make a sound is free
      // to change, and a hint that lists them goes stale silently.
      soundHint: 'Short tones in answer to what you do.',
      hapticsHint: 'A light tap in answer to what you do.',
      hapticsOnIos:
        'Vibration needs the iPhone app: a browser cannot reach the taptic engine.',
    },
    language: {
      title: 'Language',
      en: 'English',
      ru: 'Russian',
    },
    tips: {
      title: 'Hints',
      label: 'Screen tours',
      hint: 'A short tour the first time you open a screen. It switches itself off once you have been through them all.',
    },
    about: {
      title: 'About',
      version: 'Version',
      // The commit and the time these files were built from.
      build: 'Build',
      data: 'Country data',
      dataValue: 'Wikidata, UN M49',
      flags: 'Flags',
      flagsValue: 'flag-icons (MIT)',
      whatsNew: "What's new",
    },
  },
} as const;

/** The structure every translation must match: same keys, string leaves. */
export type TranslationShape<T = typeof en> = {
  readonly [K in keyof T]: T[K] extends string
    ? string
    : TranslationShape<T[K]>;
};
