# Frontend (shell)

> Status: **implemented**: Ionic shell, navigation, Home, Leaderboard,
> Achievements, Settings (Phase 3); quiz setup and the Capitals (Phase 4)
> and Flags (Phase 5) quizzes, each loaded from its own microfrontend;
> sign-in with Google (Phase 7b), required before playing, with progress kept
> on the device and synced with the account (Phase 8b); boards, rankings,
> records and the public nickname (Phase 9b), with a board per quiz setting
> and ranked runs coming from ordinary games (Phase 25,
> [ADR-014](../decisions/ADR-014-ranked-boards.md)).

## Stack

- **Angular 22:** standalone components, **zoneless** change detection,
  OnPush by default, signals, `input()`, `@if`/`@for`/`@let`.
- **Ionic 9** in iOS mode (`provideIonicAngular({ mode: 'ios' })`),
  standalone imports from `@ionic/angular`.
- **Transloco** for runtime English/Russian ([i18n.md](i18n.md)).
- **Capacitor Preferences** for settings storage (works on the web through `localStorage`).

## Structure

```
apps/shell/src/app/
  app.config.ts        providers: Ionic, router, i18n, settings, auth, progress, icons
  app.routes.ts        welcome, tabs + lazy pages, guards
  welcome/             first screen: what the app is, sign in
  auth/                signedInGuard / signedOutGuard, back to welcome when a sign-in ends
  app.ts               <ion-app><ion-router-outlet/></ion-app>
  tabs/                ion-tabs with a translucent tab bar
  home/                greeting, overall progress, Play and Learn cards, practice, achievements
  leaderboard/         the board picker, the ranking, the player's own row, my records
  achievements/        summary, legend, all 14 achievements
  settings/            account (sign-in), theme, language, about
  quiz/
    setup.page.*       category, region, difficulty and mode; starts the quiz
    quiz-ports.providers.ts  the shell's side of the microfrontend contract
    remote-routes.ts   loads a remote's routes, with a fallback when it fails
    remote-unavailable.page.ts
  core/
    tokens.ts          COUNTRY_DATASET, CLOCK
    greeting.ts        time-of-day greeting rule
    last-setup.store.ts  the quiz setup as the player last left it (device state)
    region-options.ts    the regions, named and counted, for wq-region-options
  icons.ts             explicit ionicons registration
  app-info.ts          version shown in Settings
apps/shell/src/testing/ shared test providers (not in the app build)
```

Libraries used by the shell:

| Library                          | Role                                                                           |
| -------------------------------- | ------------------------------------------------------------------------------ |
| `client-ui`                      | Tokens, themes, glass, `wq-progress-bar`, `wq-progress-card`, `wq-empty-state` |
| `client-quiz-ports`              | Tokens and interfaces the shell and the remotes share                          |
| `client-quiz-feature`            | The quiz screens themselves (`wq-quiz-play`, `wq-quiz-results`)                |
| `client-auth`                    | `AuthStore`, API calls for sign-in, bearer interceptor, Google button (GIS)    |
| `client-progress`                | `ProgressStore` (IndexedDB via Dexie), outbox, `SyncService`                   |
| `client-i18n`                    | Transloco setup, bundled translations, `wqPlural`, locale detection            |
| `client-settings`                | `SettingsStore`, storage port, system colour-scheme signal, document sync      |
| `quiz-domain` / `quiz-countries` | Progress, achievements and all counts come from the domain and the dataset     |

## Routing

| URL                                                   | Page                                                  | Loading                               |
| ----------------------------------------------------- | ----------------------------------------------------- | ------------------------------------- |
| `/welcome`                                            | welcome + sign-in (`signedOutGuard`: players go home) | lazy (`loadComponent`)                |
| `/`                                                   | redirect to `/home`                                   | —                                     |
| `/home`, `/leaderboard`, `/achievements`, `/settings` | tab pages inside `TabsPage`                           | lazy (`loadComponent`)                |
| `/quiz/setup`                                         | quiz setup (shell)                                    | lazy (`loadComponent`)                |
| `/quiz/setup?category=`                               | preselects Capitals or Flags (Home's Practise rows)   | —                                     |
| `/quiz/capitals?scope=&difficulty=&mode=&count=`      | Capitals microfrontend                                | `loadChildren` over Native Federation |
| `/quiz/flags?scope=&difficulty=&mode=&count=`         | Flags microfrontend                                   | `loadChildren` over Native Federation |
| anything else                                         | redirect to `/home`                                   | —                                     |

Everything except `/welcome` is behind `signedInGuard`
([ADR-011](../decisions/ADR-011-sign-in-required.md)): it waits for the
start-up restore, lets in a signed-in player (claiming the device's data for
them) or, offline, the player who owns the device's data, and sends anyone
else to `/welcome`. All URLs are deep-linkable, including a quiz with its
options (tested in Cypress). How the federated route is wired, and what the shell and the remote
may know about each other, is described in
[microfrontends.md](microfrontends.md).

## Sign-in (welcome screen, Settings → Account)

`libs/client/auth` (design: [ADR-010](../decisions/ADR-010-authentication.md)):

- **Start-up**: `provideAuth()` restores a previous sign-in with the httpOnly
  refresh cookie, without blocking the first render (status `restoring` →
  `signed-in` or `signed-out`; `unverified` when the API cannot be reached —
  the section says so, offers "Try again" and checks again when the browser
  is back online).
- **Welcome screen** (`/welcome`): app name, real counts from the dataset
  (countries, regions, training modes) and Google's button; its ID token and
  our nonce go to `POST /v1/auth/google`, then the device's data is claimed
  for the player and the app opens on Home. **Apple** is shown as coming with
  the iPhone app — web Sign in with Apple needs a registered HTTPS domain.
- **When a sign-in ends** (sign-out, deletion, refresh refused),
  `provideSignInFlow()` returns to `/welcome` with a new navigation root.
  Signing out always asks first: it deletes this account's results from the
  device (ADR-006), which for anything not yet sent is as irreversible as
  deleting the account, and the row sits one finger away from the rest of
  Settings.
- **The development sign-in** appears on the welcome screen whenever this
  deployment's `config.json` says `devSignIn`, on **either** platform. It
  used to be written inside the native branch of the template, so a browser
  and an installed web app had no way in, and only the iPhone build did.
- **Google's button is Google's page** (an iframe): a white "Sign in with
  Google" in both themes (black is left to Apple), drawn again when the
  language changes. Its shape, font and padding
  are Google's, and Google may show it in the language of the Google account
  signed in to the browser instead of the app's `hl`. Known limitation, with
  a TODO in `google-sign-in-button.ts`: a custom button with an OpenID Connect
  popup would give full control.
- **Tokens**: the access token only in memory, the refresh token only in the
  httpOnly cookie; nothing in `localStorage`. `authInterceptor` adds the
  bearer token to API requests and renews it once, shared, on 401; tabs take
  turns through a Web Lock. Only the API's refusal (401 from
  `/v1/auth/refresh`) signs the player out; offline, 5xx or 429 do not.
- **Settings → Account** shows the player, whether their results are saved
  (all saved / N waiting / offline, retried automatically / N refused by the
  server), sign-out and account deletion.
- **Sign-out** tries to send pending results first; if some are still
  unsent, it asks — with the number — before deleting them with the rest of
  the device's data. **Account deletion** asks inline, with the consequence
  spelled out, before `DELETE /v1/me`, then clears the device too.
- The API URL and the Google client id are **not compiled in**: the app reads
  them from `config.json` before it starts
  (`apps/shell/src/app/runtime-config.ts`, [ADR-012](../decisions/ADR-012-environments.md)),
  and a deployment replaces that file together with
  `federation.manifest.json`. `apps/shell/public/config.json` holds the
  development values.
- **In the iPhone app** the same screens use two different implementations:
  the sign-in comes from the system (`NATIVE_SIGN_IN`) instead of Google's
  web button, and the refresh token lives in the Keychain
  (`REFRESH_TOKEN_STORE`) instead of an httpOnly cookie. Both are ports with
  a web default, chosen in `app.config.ts`; see
  [ios.md](../deployment/ios.md).
- Progress and sync: [state-management.md](state-management.md) and
  [ADR-006](../decisions/ADR-006-local-persistence.md).

## Leaderboard (boards, rankings, records)

Rules: [leaderboard.md](../domain/leaderboard.md).

- **A board is the four settings a quiz is played with**, so it is chosen
  with the very controls the quiz setup asks those questions with: tiles for
  the quiz type and the difficulty, `wq-region-options` for the region, and a
  row per ranked mode whose second line says what that board asks of a player
  ("Answer 10 random questions correctly, faster than anyone else"), in the
  words they would use themselves rather than as a description of a SQL
  order. The same question must not look like a different question from
  screen to screen.
- **The picker opens where the player left it.** The four choices are
  `linkedSignal`s over `LastSetupStore.board()`, remembered when a board is
  shown — the same convenience the quiz setup has, kept as a separate fact
  from it (a player may well play Europe on Hard and look at the easy World
  board).
- **The ranking opens over the page** (`wq-dialog`) when the player presses
  "Show the board" — a button in the page, under the last choice, exactly
  where the quiz setup's Start quiz now is. Four choices and a table do not
  fit on a phone together, and the table is what the player came for; under
  the choices it started a screen down. Asking for the same board again
  reloads it — a run finished since may have reached it — and nothing is
  fetched until it is asked for.
- The dialog's title is just "Leaderboard"; which of the 56 boards it is
  stands under a trophy in the card, as **two lines** (category · region,
  then difficulty · mode), because the four settings on one line wrapped
  after the third on a phone.
- Inside the dialog: rank, nickname, the score in the board's own terms (a
  time `m:ss.t`, or "21 correct" with the time beside it) and the number of
  players. The player's own row is highlighted in place (`aria-current`) and,
  when their place is below the page shown, **pinned under the list** — the
  board is worth opening from #248. Loading, error with retry and empty
  states are explicit.
- **Nothing is started here.** Any game in a ranked mode competes, so the
  screen has no "play" of its own. Which modes are ranked is said where a
  mode is chosen instead: an "i" beside Game mode on the quiz setup
  (`setup.modeInfo`) — by the time a player is looking at a board, the run is
  already played.
- **Everyone or friends.** A segment over the ranking asks who is on the
  board, and the "Friends" side is the same board over fewer people —
  `GET /v1/friends/leaderboards/:board`, the public query narrowed to the
  player and their friends. It is a switch and not a second screen because
  what it changes is who is ranked, not what is asked. The player's own row
  is still highlighted in place, but **nothing is pinned** under a board of
  friends: the rank a record carries is the one on the public board, so it
  says nothing about where the player stands among the people they know. An
  empty one says so in its own words ("Nobody you know is on this board
  yet"), because the public board's "be the first" is wrong advice there.
- **Which row is the player's own** is answered differently on the two
  sides. On the public board it is the row at their rank, which is unique
  there and comes straight from `/v1/me/records`. A board of friends
  numbers its places over fewer people, so that number names somebody
  else's row; there the run is found by the moment the server recorded it
  and the nickname beside it — and **one** row is marked, never every row
  that matches, because two runs can share a millisecond (the ranking
  itself breaks that tie by session).
- **My records**: one row per board the player ranks on, with the score and
  the place, each shareable as a picture; nothing at all is "No records yet"
  rather than 56 empty rows.
- The player's own row takes its name from `GET /v1/me/records`, which
  carries the nickname: the public board is the same for everyone (that is
  what lets it be cached), and ranks are unique, so the two are matched by
  rank and no nickname is ever compared.
- Records are loaded when the tab is shown and **after every sync**
  (`SyncService.lastSyncedAt`), and so is an open board: Ionic can show this
  cached page again without `ionViewWillEnter`, and a run reaches the API
  through the sync.
- **The place on the results** (in the remote): the sink hands over a promise
  of the API's answer only when the run could rank at all, so the card says
  "Checking the board…", then the place and the score, or that the run is
  saved but not on the board yet (offline). A run that could never rank is
  not mentioned — a screen that explains why every ordinary game did not win
  would say it after every game.
- **A personal record is the loud case.** It turns that card into the brand
  gradient the shared picture is drawn on: a trophy, "New personal record!"
  as the headline, the board under it and two labelled figures (the place,
  and the time or the count with the time beside it), with one slow sheen as
  it arrives (none under `prefers-reduced-motion`). It carries a share of its
  own, which hands over the **record's** picture (`recordShareCard`, the one
  "My records" shares) rather than the run's — the record is what the player
  wants to show. Everything quieter stays a plain card, with a gold, silver
  or bronze medal beside a place in the first three; a screen that celebrates
  everything celebrates nothing.
- **Public name**: Settings → Account shows the nickname and edits it in a
  dialog, validated with the API's own `nicknameSchema` before sending
  (`PATCH /v1/me` through `AuthStore.setNickname`).

## Friends (ADR-015)

Rules and endpoints: [ADR-015](../decisions/ADR-015-friends.md),
[backend.md](backend.md).

- **`FriendsStore`** (`apps/shell/src/app/friends/friends.store.ts`) is the
  one place the three lists live: `httpResource` on `GET /v1/friends`, which
  asks for nothing at all while nobody is signed in. Mutations are plain
  calls that **reload** the lists rather than patching them — accepting a
  request empties one list and fills another, and the server is the one that
  knows what the result was. Home's card and the bell read the same signals,
  so a request is news on the first screen of the app without a second fetch.
- **The invite is a dialog, not the top of the screen** (`invite-dialog.ts`):
  the player's own code as a QR, as spaced characters ("ANN1 2345"), a share
  that hands the link to the sheet or the clipboard, and the field for
  somebody else's code. Both halves of the exchange are in one place because
  they are one moment, usually with two phones side by side. The screen
  itself is the list of people — an invite card holding the top of it for
  ever would push the list half a screen down — so the invite lives behind
  the `+` in the header, and the empty state offers it as its action.
- **The code is checked before it is sent.** `inviteCodeSchema` /
  `normaliseInviteCode` (contracts) read what was typed — case, spaces,
  dashes, `I`/`L` as `1`, `O` as `0` — and the player's **own** code is
  refused in the app: it is the one mistake the client can recognise on its
  own, and it deserves an answer at once rather than a round trip. The
  message appears beside the field (`role="alert"`), not as a toast: it is a
  standing fact about what is typed there.
- **The invite link is a public route.** `/invite/:code` is the only route
  besides `/welcome` outside the sign-in guard, because an invite is usually
  sent to somebody who has no account yet. The page shows nothing of the app:
  it writes the code into `KEY_VALUE_STORAGE` (the device's note to itself,
  not the account's — signing in takes a round trip to Google and this page
  does not outlive it), waits for `AuthStore.whenRestored()` and sends the
  player to `/friends` or `/welcome`. `FriendsStore` then sends the request
  from an `effect` on `signedIn()`, once, and **forgets the code whatever
  came of it**: a code that cannot be used must not be retried on every
  start. The code is read as a route **input** inside an effect, not in the
  constructor — a required input read before the router has set it throws.
- **A page that cannot be read says which of the two it is.** A 404 is the
  API saying this player is not yours to see — not a friend any more, or
  gone — and that is a fact about the friendship, so the page says so and
  offers nothing to press. Anything else is the connection, and gets the
  same offline card with a retry that the list has: telling a player their
  friendship has ended because their train went into a tunnel would be a
  lie with a button missing underneath it.
- **A friend's page** (`friend.page.ts`) is `GET /v1/friends/:id`: their
  nickname, how long you have been friends, their best run per board (with a
  gold/silver/bronze medal for a place in the first three, the score in the
  board's own terms) and their achievements, the ones they have got furthest
  with first. A page that is not yours to see — not a friend any more, or the
  player has left — is a 404 from the API and says the same thing here,
  never that you are not allowed.
- **Ending a friendship is asked for on that page**, in a `tone="danger"`
  dialog: it is where there is something to look at before deciding.
  Declining a request and unfriending are the same call, so the lists
  themselves only ever offer the quick answer (accept, or the `×` that says
  no).
- Home's **Friends card** is the third `.offer` card, in the shape of Play
  and Learn, and carries the mark when somebody is waiting: the bell is a
  list of everything the app has to say, and the card is the thing this
  message is about. Coming back to the tab asks who is waiting again
  (`ionViewWillEnter`), because requests arrive while the app is open.

## Sharing a result

`SHARE_TARGET` (`client/ui/share.ts`) is the one way out of the app: it
tries `navigator.share` (the system sheet, which phones and Safari have),
falls back to the clipboard where there is no sheet — or where the sheet
refused for any reason other than the player cancelling — and answers
`shared` / `copied` / `cancelled` / `failed`. It defaults to the browser, so
no screen needs a provider, and a test or a server render replaces it. The
screens report only `copied` and `failed`, in a toast: the sheet opening is
its own confirmation, and the player closing it was an answer.

Two screens share: the results of a finished run (the hero's corner) and a
personal record on the leaderboard (the row's right end). Both build the
message from **translated lines** — `client/ui` holds no translations, so
`shareLines()` only joins what it is given and drops what the run has
nothing to say about (no rank, no address).

The link is the **address of this deployment**, which the app cannot work
out for itself: `appUrl` in `config.json` decides it (ADR-012), and
`shareableAppUrl()` falls back to the origin the page was served from when
it is empty. In the iPhone app that origin is the bundle, which means
nothing to whoever receives the message, so the native build sets `appUrl`
explicitly and an unset value shares the text with no link at all. Since a
remote cannot know any of this, the host passes it as `APP_URL`
(`client/quiz-ports`), beside the other things only the shell knows.

### The picture

A chat shows a picture, not a line of text, so a run and a record are also
**drawn** as a card (`client/ui/share/share-card.ts`), a 1080px square that
every chat shows whole. The picture travels **alone**: where a file can be
shared, no text and no link go with it, because an app that receives both
may post them as two things and the text then repeats the card.

That makes the card responsible for explaining itself, so it is laid out in
reading order: the **claim** first ("New personal record!"), the figure that
backs it, what was played, where the run landed, and one line at the foot
daring the reader to beat it. `shareClaim`
(`client/ui/share/share-claim.ts`) picks the claim from what the run did,
loudest first: a record over a place, a place over a flawless run, and
nothing at all over a claim it cannot back up. A place in the first three is
a **filled gold disc with the number in white**, the largest thing under
the claim, because where the run landed is the fact the picture is there to
tell. All three places share the app's `--wq-color-hint` gold — silver and
bronze are a grey and a brown disc on a white card, and the number says
which place it was — fixed rather than read from `--wq-color-medal-*`,
which are the darkened text versions a light page writes a place in. A board the player is alone on says so instead of
boasting about being first of one.

Both pictures are the same object — a white card under a band in
`--wq-color-primary` carrying the app's name. A **record** is told apart by
the trophy over its claim (Ionicons' `trophy` path on the canvas, since a
picture has no icon font) and by the row under it, where the medal and the
figure the record was set with stand side by side, divided by a hairline,
the figure labelled underneath ("Time", "Correct") and bare ("21", not "21
correct") because beside a medal there is only room for a number. A run's
card keeps its big headline figure instead and ends with accuracy and time.
The address is **not** on the picture: it is a card to look at, not an
advertisement.

It is drawn on a `<canvas>`, not screenshotted. The results card on screen
is glass over a blurred backdrop, which the libraries that rasterise the DOM
cannot draw at all (and Ionic's components live in shadow roots they do not
reach); drawing it also makes the picture the same everywhere, whatever the
phone decided to scroll or scale. The app loads no web font, so the card is
drawn in the same letters the player is looking at, and its colours are read
from the `--wq-*` tokens on `<html>` — the picture follows the theme the
player shared it from, and a token the document does not define falls back
to the light theme.

The layout is a **pure function** of the card and the palette
(`shareCardPlan`), so what ends up on the picture is tested without a
canvas; `drawShareCard` only executes the plan, and each piece of text
carries the width it may take, which `fillText` condenses it into — a long
region name cannot run over the card's edge. The words themselves come from
`runShareCard` (`client/quiz-feature`) and `recordShareCard` (the shell's
leaderboard), built outside their components for the same reason.

The picture is offered **only where the device takes files**:
`SHARE_TARGET` asks `canShare({ files })` first and paints nothing when the
answer is no (desktop Safari and Firefox), so the fallback is the text. That
message opens with the **same claim** the picture would have led with, so
the two can never say different things, and it carries the address in its
own field. A canvas the browser refuses (an old WebView without `roundRect`)
simply means no picture, never a failed share.

The results screen has **one** share button. Which picture it hands over
follows what happened — the record when the run set one, the run otherwise —
because two buttons side by side asked the player to choose between two
pictures they had not seen. "My records" on the leaderboard stays the second
way to share a record that was set earlier; a record looked up there is not
news, so its claim is the place rather than "New personal record!".

### Which version is running

Settings → About shows the version and, when the bundle was stamped, the
build it came from. Both are read from `<meta>` tags in `index.html`
(`app-info.ts`): a development build says so rather than inventing a number,
because a version nobody stamped is not a version. How they are produced is
in [deploying.md](../deployment/deploying.md).

### What changed in this release

A player who does not look for a change does not find one, so the app says
what changed in the build they are running.

**The notes are in the bundle**
(`apps/shell/src/app/release-notes/releases.json`, read by
`release-notes.ts`), not served by the API: they describe the code they ship
with, so a release can never claim a change the running build does not have,
and the page works offline, in the iPhone bundle and on a deployment with no
API. They are JSON rather than TypeScript because `npm run release` rewrites
them (releasing.md) — a script editing a TypeScript literal would be a regex
away from breaking the app — and what types cannot check about hand-written
data (the same number of lines in both languages, one entry per version) a
test over the real file does.

**The bell on Home** (`notification-bell.ts`, `NotificationsStore`) is what
the app has to say, as opposed to the outcome of something the player just
did — that is a toast. It is a **list**, not a sentence: today the only
message is an unread release, and a friend's challenge is the next thing to
belong there. It does not disappear when there is nothing in it; it says so,
because a control that comes and goes is one nobody learns. It sits in the
far corner of the floating header, which projects it into the third column
of its grid through the global class `.wq-header-action` (design-system.md).

**The mark is a dot in two places**: on the bell and on Settings → What's
new, for a player who never presses the bell. Both read the same stored
value, and **opening the page** is what clears them — pressing the bell does
not, or the mark would go while the page it points at was never seen. The
value lives in `KEY_VALUE_STORAGE` beside the tours and the last quiz setup:
having read what changed belongs to the device, not to the account, so
signing out does not make it unread again.

**A device with nothing stored is level with the build it starts on.** A new
player is not behind on a release they have never seen. The cost is that the
first release after this screen shipped goes unannounced, and every release
after it does not.

## Start-up sequence

1. `provideAppSettings()` registers an **app initializer**:
   - load settings from storage;
   - load the translation file for the stored (or device) language;
   - start `DocumentSettingsSync`.
2. Only then does Angular render, so there is no flash of the wrong theme or of untranslated keys.
3. `DocumentSettingsSync` keeps `<html class="ion-palette-dark">`,
   `color-scheme`, `<html lang>` and the active Transloco language in sync with
   the store for the rest of the session.

## Data shown on screens

Everything is derived; nothing is copied from the Figma mock-ups:

- **Country and region counts** (195, 6) come from the dataset.
- **Overall progress** is Capitals + Flags mastered, out of 2 × 195.
- **Achievements** (14) come from `evaluateAchievements`, with per-scope totals from the dataset.
- **Practice Mistakes** comes from `practiceCandidates`.
- **The countries reference** (`/countries`, opened from Home) is the dataset
  itself: every country of the chosen region with its capital and its flag,
  sorted with an `Intl.Collator` of the display language. The capital and the
  flag are each lit green on their own, by `isMastered` — mastery is kept per
  category (`capitals:fr` and `flags:fr` are separate states), so one combined
  mark would claim knowledge the player may not have.
- **One way into the quiz.** Home has a single Play card, and what it says it
  will start is the setup the player last played (`LastSetupStore`,
  `apps/shell/src/app/core/last-setup.store.ts`): category, region, difficulty
  and mode, as four words. Choosing the category belongs to the setup screen,
  which is where the other three choices already are — Home asked the same
  question a second time and answered it differently from what the player had
  picked the time before.
  - The setup screen seeds all four choices with `linkedSignal`s over the
    store, so a player moves them freely and the screen starts again from the
    remembered setup whenever it is opened afresh. A query parameter still
    wins: Home's "Practise" rows carry `?category=&mode=practice`.
  - The modes that reach a board say so on the row itself (a "Ranked" pill),
    and **Start quiz is part of the page**, under the last choice: a button
    pinned to the foot of the screen is visible before the choices it uses
    are. It is hidden while the tour runs, which is what keeps a quiz from
    starting mid-explanation.
  - `start()` is what remembers, not every tap, and **Practice Mistakes is
    never remembered** — it is an action, not a preference, and a player who
    practised once would come back to a screen whose Start button is disabled
    because there are no mistakes left.
  - Like the tours, this is device state (`KEY_VALUE_STORAGE`), not account
    state: signing out does not make the player want a different region.
    `provideLastSetup()` loads it before the first render.
  - The same store keeps the **board** the leaderboard last showed, under a
    key of its own. The two are the same four questions and the same kind of
    fact, so they share the plumbing — but never the value: one overwriting
    the other would move the ground under whichever screen is opened next.
- **The region is a sketch as well as a name.** `wq-region-options`
  (`client/ui`) is the region grid of both the quiz setup and the countries
  reference: each option carries a hand-drawn globe of that part of the
  world, used as a CSS **mask** rather than an image, so one file serves both
  themes and the selected state (see design-system.md). The names and counts
  come from `regionOptions()` in `apps/shell/src/app/core/`, so the two
  screens cannot drift apart. The category and the difficulty are square tiles
  carrying what the quiz asks for and how much of it is mastered, and how an
  answer is given — the choice is about the thing, not about the words
  "Capitals" and "Hard". Home's Play card wears a neutral globe, because it
  is one card for both categories.
- **Leaderboard** shows real rankings and records from the API.

`ProgressStore` (`client-progress`) keeps the finished sessions on the device
(IndexedDB) and rebuilds progress from their answers. The shell's quiz result
sink calls `ProgressStore.recordSession(session)` after each finished
session and asks `SyncService` to send it.

## Bundle size

Native Federation changes how this is measured: the entry point only starts
federation, and nearly everything — including Angular, Ionic and the workspace
libraries — is loaded as **shared ES modules through a generated import map**.
The builder's "initial" number therefore no longer equals what the browser
fetches for the first paint.

Production build (Phase 4):

|                                                           | Raw        | Transferred (est.) |
| --------------------------------------------------------- | ---------- | ------------------ |
| Shell entry (`main` + polyfills)                          | ≈ 46 kB    | ≈ 15 kB            |
| Shared framework module (Angular + Ionic), loaded at once | ≈ 710 kB   | ≈ 150 kB           |
| Each tab page                                             | 3–10 kB    | 1–3 kB             |
| Each translation file                                     | 2.5–3.5 kB | ≈ 1 kB             |
| Capitals remote's own code (loaded when a quiz starts)    | ≈ 8 kB     | ≈ 3 kB             |

The remote is that small because the host and the remote **share the workspace
libraries too**: `@world-quiz/quiz/domain`, `quiz/countries`, `client/ui`,
`client/i18n`, `client/settings`, `client/quiz-ports` and
`client/quiz-feature` appear in both `remoteEntry.json` files and resolve to
one copy at runtime. Native Federation picks them up from the `tsconfig`
path mappings; without that, opening a quiz would download a second country
dataset.

The Angular CLI template budget (500 kB warning) is below the Angular + Ionic
baseline, so the initial budget is **800 kB warning / 1 MB error**. On iOS
the files load from the device, not the network. Pages and translations are
lazy.

## Testing

- Component tests render pages with the real providers
  (`provideShellTesting()`), using in-memory storage, a fixed clock and a chosen language.
- `tools/testing/jsdom-setup.ts` adds the two browser APIs jsdom lacks and
  Ionic uses (`matchMedia`, `Element.scrollTo`); every project that renders
  components loads it.
- Ionic events (`ionChange`) are dispatched as DOM events in tests, which is
  exactly how Angular's Ionic bindings receive them.
- Cypress covers navigation, deep links, system/explicit theme, language
  switching and persistence across reloads, bundled flag assets, and the full
  Capitals quiz journey across the microfrontend boundary.
