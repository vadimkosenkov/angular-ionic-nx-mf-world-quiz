/**
 * English texts of the site. `ru.ts` must have the same shape (`SiteText`).
 *
 * The legal pages describe what the service actually does, as built: what
 * the API stores (apps/api/src/db/schema.ts), what stays on the device, which
 * cookies exist, and what deleting the account removes. Change them together
 * with the code.
 */
export const en = {
  nav: {
    home: 'Home',
    leaderboard: 'Leaderboard',
    privacy: 'Privacy',
    terms: 'Terms',
    play: 'Play',
    main: 'Main navigation',
    otherLanguage: 'Русский',
  },
  footer: {
    note: 'World Quiz — learn the capitals and flags of 195 countries.',
  },
  home: {
    title: 'World Quiz — capitals and flags of 195 countries',
    description:
      'Learn every capital and flag of the world: easy and hard modes, progress by region, and perfect-run leaderboards.',
    heading: 'World Quiz',
    tagline: 'Master every capital and flag.',
    points: [
      '195 countries: the UN members, the Holy See and Palestine.',
      'Easy: pick one of four answers. Hard: type the answer — small typos are forgiven.',
      'Progress by region: a country is mastered after three correct answers in a row in Easy mode, or two in Hard mode.',
      'Plays offline; your results follow your account to every device.',
      'English and Russian.',
    ],
    play: 'Play in the browser',
    leaderboard: 'See the leaderboards',
  },
  leaderboard: {
    title: 'Leaderboard',
    description:
      'The fastest perfect runs through all 195 countries, for capitals and flags, easy and hard.',
    boardsLabel: 'Board',
    boards: {
      'capitals-easy': 'Capitals · Easy',
      'capitals-hard': 'Capitals · Hard',
      'flags-easy': 'Flags · Easy',
      'flags-hard': 'Flags · Hard',
    },
    rules:
      'A run counts only when every one of the 195 countries is answered correctly. The fastest time wins; each player appears once, with their best run.',
    rank: 'Rank',
    player: 'Player',
    time: 'Time',
    players: (count: number) =>
      count === 1 ? '1 player ranked' : `${count} players ranked`,
    empty: 'No perfect runs yet. Be the first — play in the app.',
    unavailable:
      'The leaderboard cannot be loaded right now. Please try again later.',
    notFound: 'There is no such leaderboard.',
    freshness: 'Updated every 30 seconds at most.',
  },
  legal: {
    draft:
      'Draft: this service is not public yet. The operator’s name and contact address will be added here before it is.',
    contactPending:
      'The operator’s name and contact address will be published here before the service goes live.',
    contact: (name: string, email: string) =>
      `The service is operated by ${name}. Questions about this page or your data: ${email}.`,
    updated: 'Last updated: 22 September 2026',
  },
  privacy: {
    title: 'Privacy Policy',
    description:
      'What World Quiz stores about you, why, for how long, and how to delete it.',
    sections: [
      {
        heading: 'In short',
        paragraphs: [
          'World Quiz stores what it needs to run your account, your quiz results and the leaderboards — nothing more. There are no ads, no analytics and no tracking cookies. You can delete your account and everything stored with it at any time, in the app.',
        ],
      },
      {
        heading: 'Your account',
        paragraphs: [
          'You sign in with Google (with Apple, once the iPhone app is available). We receive a token from the provider that says which account you used; we keep the provider’s account identifier and, when the provider shares a verified one, your e-mail address (Apple also shares your name on the first sign-in). The identifier connects your account; the address and name are shown only to you, in the app, and are not used to contact you.',
          'You never give us a password. Signing in is handled by the provider on its own pages, under its own privacy policy.',
        ],
      },
      {
        heading: 'Your results',
        paragraphs: [
          'When you finish a quiz, the app sends what you did: the quiz settings, the answers you gave (including what you typed in Hard mode) and when. Our server checks and grades them and keeps them with your account, so your progress is the same on every device.',
          'For leaderboard challenges we also keep the challenge, its time and whether it was ranked.',
        ],
      },
      {
        heading: 'What is public',
        paragraphs: [
          'Leaderboards are public, on this site and in the app. They show a nickname you choose (until then an automatic one such as “Player 4821”), your time and your rank — never your name, e-mail address or account identifier.',
        ],
      },
      {
        heading: 'On your device',
        paragraphs: [
          'The app keeps your results and the account you are signed in with in your browser’s storage (IndexedDB), so it works offline, and your theme and language settings in local storage. Signing out deletes the results and account data from the device.',
          'One cookie is set: a sign-in cookie that keeps you signed in while the browser is open. Scripts cannot read it, and it is sent only to our sign-in service; the sign-in it carries expires after 30 days at most.',
          'The sign-in screen loads Google’s sign-in button from Google, which may set its own cookies under Google’s privacy policy.',
        ],
      },
      {
        heading: 'Security',
        paragraphs: [
          'Connections are encrypted. Sign-in tokens are stored only as one-way hashes. To stop automated attacks, the addresses of devices that sign in are held in memory for 15 minutes to limit repeated attempts; they are not stored.',
        ],
      },
      {
        heading: 'How long we keep it, and deleting it',
        paragraphs: [
          'Your data is kept for as long as you have an account. In the app, Settings → Account → Delete account deletes your account together with your results, challenges and sign-ins immediately; your entries disappear from the leaderboards. The service keeps no other copy.',
        ],
      },
      {
        heading: 'Why we use it',
        paragraphs: [
          'We process this data to provide the service you signed up for (your account, your progress and the leaderboards) and, for security, in our legitimate interest in protecting the service. We do not sell it, share it for advertising or use it for anything else.',
        ],
      },
      {
        heading: 'Your rights',
        paragraphs: [
          'You can see your results in the app and delete everything at any time. You may also ask for a copy of your data, for corrections or for deletion, and complain to your data protection authority.',
        ],
      },
      {
        heading: 'Where it is stored',
        paragraphs: [
          'The service is not publicly hosted yet. Where it is hosted, and which providers process data on our behalf, will be listed here before it goes live.',
        ],
      },
    ],
  },
  terms: {
    title: 'Terms of Use',
    description: 'The rules for using World Quiz and its leaderboards.',
    sections: [
      {
        heading: 'The service',
        paragraphs: [
          'World Quiz is a free app for learning the capitals and flags of the world. It is provided as it is: we work to keep it available and correct, but cannot promise that it will always be available or free of errors, and it may change.',
        ],
      },
      {
        heading: 'Your account',
        paragraphs: [
          'Playing needs an account, created by signing in with Google (or Apple, on iPhone). Keep access to that account safe; what is done with your World Quiz account is your responsibility. You can delete it at any time in the app.',
        ],
      },
      {
        heading: 'Fair play',
        paragraphs: [
          'Leaderboards are for runs you played yourself, by hand. Do not use scripts, bots or other automation, and do not try to change or forge results. Runs that break these rules may be removed and the account excluded from the leaderboards.',
        ],
      },
      {
        heading: 'Nicknames',
        paragraphs: [
          'Your nickname is public. Do not choose one that is offensive, impersonates someone or contains personal information. A nickname that breaks this rule may be replaced by an automatic one.',
        ],
      },
      {
        heading: 'Content',
        paragraphs: [
          'Country data comes from Wikidata and the UN M49 standard; flags are from the flag-icons project (MIT licence). Borders, names and capitals follow the choices documented with the app and do not express a position on any territory.',
        ],
      },
      {
        heading: 'Changes',
        paragraphs: [
          'If these terms change, the new version is published here with its date. Continuing to use the service means accepting it.',
        ],
      },
    ],
  },
};

export type SiteText = typeof en;
