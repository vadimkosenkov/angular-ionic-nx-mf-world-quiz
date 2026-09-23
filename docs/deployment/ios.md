# The iPhone app (Capacitor)

> Status: ⚙️ Phase 13a — the app builds and runs in the **simulator** with
> both quizzes inside its bundle. **Signing in does not work in the app
> yet** (Phase 13b), and there is no signed build, no TestFlight and no App
> Store entry: all three need a paid Apple Developer account, which this
> project does not have. Why the quizzes ship inside the app:
> [ADR-013](../decisions/ADR-013-ios-bundled-remotes.md).

## What the app is

`apps/shell` wrapped by Capacitor 8. The web view loads a bundle that
contains the shell **and** the Capitals and Flags remotes, so the app works
offline and never downloads code (ADR-013). The API is reached over HTTP,
like the web app, and its address is in `config.json` inside the bundle.

```
apps/shell/
  capacitor.config.ts        appId, appName, webDir → dist/apps/shell/ios-www
  ios/App/                   the Xcode project (committed)
tools/scripts/build-ios-bundle.mjs
```

## Building and running

```bash
npx nx run shell:ios-bundle    # builds shell + both remotes, assembles ios-www
npx nx run shell:ios-sync      # the above, then `cap sync ios`
npx nx run shell:ios-open      # opens the project in Xcode (Run ▶ to launch)
```

The API the app talks to comes from the environment of the bundle step:

```bash
API_URL=http://192.168.1.10:3333 npx nx run shell:ios-sync
```

- The **simulator** shares the Mac's network, so the default
  `http://localhost:3333` works with `npm run start:api`.
- A **real device** cannot reach `localhost`: use the Mac's address on the
  local network (as above) or a deployed API. Plain HTTP to a private
  address is allowed by App Transport Security only for development builds;
  a shipped app needs HTTPS.

`GOOGLE_CLIENT_ID` is deliberately unset for the app: the web sign-in cannot
run in a web view (see below), so the bundle does not offer it.

## What works, and what does not

Everything in the app is behind sign-in (ADR-011), and **signing in does not
work in the app yet** — so the only screen the app can currently show is the
welcome screen, which says exactly that. The rest is shipped and proven, but
not reachable from the app until Phase 13b:

| In the app                                          | State                                                                                                                   |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Starts and reaches the API                          | ✅ checked in the simulator                                                                                             |
| The welcome screen's honest "no sign-in yet" notice | ✅                                                                                                                      |
| Both quizzes, offline, from the bundle              | ✅ the bundle is complete and passes the quiz journeys (see **Testing**), ⛔ unreachable in the app until sign-in works |
| Signing in                                          | ❌ **not yet** — Phase 13b                                                                                              |
| Sign in with Apple                                  | ❌ needs a paid Apple Developer account                                                                                 |
| A signed build, TestFlight, the App Store           | ❌ needs a paid Apple Developer account                                                                                 |

**Why signing in does not work yet.** Google's sign-in is Google's own page,
and Google refuses to show it inside an app's web view
(`disallowed_useragent`). A native sign-in is needed instead: the app asks
iOS for the ID token and hands it to the same `POST /v1/auth/google`. That
is Phase 13b, together with keeping the refresh token in the Keychain rather
than in a cookie (the API already supports `refreshTokenIn: 'body'` for
exactly this, ADR-010).

**One API change was needed for the app**: Capacitor serves the bundle from
`capacitor://localhost`, and the web view sends that as `Origin`, so the API
now always allows it in CORS (`NATIVE_APP_ORIGIN` in `apps/api/src/config.ts`).
Without it every request from the app failed and the welcome screen said the
server could not be reached.

## What a paid Apple Developer account would add

It costs about 99 USD a year (check the current price) and is required for:

- **Sign in with Apple** — a Services ID and a signing key.
- **Running on a real iPhone without re-signing every 7 days.** A free
  Apple ID can install the app on your own device, but the signature expires.
- **TestFlight and the App Store.**

The simulator needs none of it, which is why Phase 13a stops there.

## Releasing later (not automated)

When an account exists, the steps are:

1. In Xcode: set the team on the `App` target, choose a bundle identifier
   you own (`com.worldquiz.app` here is a placeholder), and set the version
   and build number.
2. Provide an app icon and a launch image (the Capacitor placeholders are
   still in `ios/App/App/Assets.xcassets`).
3. `Product → Archive`, then `Distribute App → TestFlight & App Store`.
4. App Store Connect needs the Privacy Policy URL — the public site serves
   it (`/en/privacy`), which is why it exists (ADR-003).
5. Only then is a CI workflow worth writing: a macOS runner, the signing
   certificate and profile as secrets, `xcodebuild archive` +
   `xcrun altool`. It is deliberately **not** in `release.yml` today,
   because it could never run.

## Testing

The app is the same code as the web, so unit, component and E2E tests cover
its behaviour (`docs/testing/strategy.md`).

The one thing that is genuinely different — the **bundle with the remotes
inside it** — is testable without the simulator, because it is the same
bundle the app's web view loads:

```bash
npx nx serve api                      # :3333, dev sign-in
npx nx run shell:serve-ios            # builds the bundle and serves it on :4200
npx cypress run --project apps/shell-e2e \
  --config baseUrl=http://localhost:4200,video=false
```

The quiz journeys pass there only if the bundled remotes really load through
the local manifest. (They did not at first: relative paths in the manifest
produce import-map entries a browser cannot resolve — see the gotcha in
CLAUDE.md.)

What is left for the simulator — that the app starts, keeps its settings
across a restart and shows the right screens — is checked by hand; there is
no automated iOS UI test, and pretending otherwise would be worse than
saying so.
