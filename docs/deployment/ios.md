# The iPhone app (Capacitor)

> Status: ⚙️ Phase 13b — the app builds and runs in the **simulator** with
> both quizzes inside its bundle and a **native sign-in**: iOS shows
> Google's own sheet, and the refresh token lives in the **Keychain**. A
> build only offers Google sign-in when it is given an iOS OAuth client
> (below). There is still no signed build, no TestFlight, no App Store entry
> and no Sign in with Apple: all four need a paid Apple Developer account,
> which this project does not have. Why the quizzes ship inside the app:
> [ADR-013](../decisions/ADR-013-ios-bundled-remotes.md); how sign-in works:
> [ADR-010](../decisions/ADR-010-authentication.md).

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

## Signing in

Google's sign-in is Google's own page, and Google refuses to serve it inside
an app's web view (`disallowed_useragent`) — an app could read what is typed
there. So the app asks **iOS** instead
(`@capgo/capacitor-social-login` wraps Google's iOS SDK): the account sheet
belongs to the system, and the app only receives an ID token, which the API
verifies exactly as it verifies the web one (same endpoint, same checks,
same fresh nonce per attempt).

The **refresh token** cannot be a cookie in an app, so the API returns it in
the response body (`refreshTokenIn: 'body'`, already part of ADR-010) and
the app keeps it in the **Keychain**
(`@aparajita/capacitor-secure-storage`), not in `localStorage` or
Preferences, which are plain files in the app's container. iCloud
synchronisation is off, so the token never leaves the device. Every answer
from the API carries a rotated token, which replaces the stored one; signing
out deletes it.

### Giving a build a Google sign-in

1. In Google Cloud Console → Credentials, create an **OAuth client id of
   type iOS** in the same project as the web client, with the bundle
   identifier from `capacitor.config.ts` (`com.worldquiz.app` unless you
   changed it). No Apple Developer account is needed for this.
2. Add its **reversed** form as a URL scheme, so Google can return to the
   app — in `apps/shell/ios/App/App/Info.plist`:

   ```xml
   <key>CFBundleURLTypes</key>
   <array>
     <dict>
       <key>CFBundleURLSchemes</key>
       <array>
         <string>com.googleusercontent.apps.YOUR-CLIENT-ID</string>
       </array>
     </dict>
   </array>
   ```

3. Build the bundle with the client id:

   ```bash
   GOOGLE_IOS_CLIENT_ID=YOUR-CLIENT-ID.apps.googleusercontent.com \
   npx nx run shell:ios-sync
   ```

Without step 3 the app says plainly that this build has no sign-in.

### The development sign-in

For working on the app before that client exists, a build can offer the
API's development sign-in (`POST /v1/auth/dev`, which only a development API
serves and production refuses):

```bash
DEV_SIGN_IN=true npx nx run shell:ios-sync
```

The welcome screen then shows a "Development sign-in" button next to (or
instead of) Google's. It is off in every other build.

## What works, and what does not

| In the app                                                  | State                                                 |
| ----------------------------------------------------------- | ----------------------------------------------------- |
| Starts and reaches the API                                  | ✅                                                    |
| Signing in through the system, session kept in the Keychain | ✅ with an iOS client id (or the development sign-in) |
| Both quizzes, offline, from the bundle                      | ✅                                                    |
| Progress, achievements, sync with the account               | ✅ the same code as the web                           |
| Sign in with Apple                                          | ❌ needs a paid Apple Developer account               |
| A signed build, TestFlight, the App Store                   | ❌ needs a paid Apple Developer account               |

**One API change was needed for the app**: Capacitor serves the bundle from
`capacitor://localhost`, and the web view sends that as `Origin`, so the API
always allows it in CORS (`NATIVE_APP_ORIGIN` in `apps/api/src/config.ts`).

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

What is left for the simulator is checked by hand: the app starts, signs in
(with the development sign-in), and **stays signed in after a restart** —
which is the real test of the Keychain, and the one that caught the bug
below. There is no automated iOS UI test, and pretending otherwise would be
worse than saying so.

> **The app bootstraps twice.** `main.ts` runs again under the federation's
> import map, so two applications — and two `AuthStore`s — start in one web
> view. Both read the stored refresh token, both presented it, and the API
> (correctly) treated the second use as theft and revoked the family: the
> app was signed out on every restart. The fix is to read the token inside
> the lock that already serialises refreshes, so the second instance sends
> the token the first one received.
