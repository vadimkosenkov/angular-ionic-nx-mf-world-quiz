# Releasing: what changed, and who says so

Every deployment of the app carries a list of what changed in it, which the
player reads in the app itself (the bell on Home, Settings → What's new).
This is how that list is written and cut.

## A deploy is a release

The app's version is `major.minor` from `package.json` plus the number of
commits as the patch (deploying.md), so the patch moves on its own with
every deployment and the **series** — `0.4` — is what a release note is
filed under. Publishing the web app is therefore a release: it bumps the
minor, it dates an entry, and the app it publishes shows that entry.

A deploy that is genuinely not news — documentation, CI, infrastructure —
says so instead, and the version stays where it is:

```bash
npm run deploy:web:no-note
```

Plain `deploy:web` **stops** while lines are still waiting, because
shipping changes the app's own notes do not mention is the failure this
whole arrangement exists to prevent.

## Writing a line

The notes live in
[`apps/shell/src/app/release-notes/releases.json`](../../apps/shell/src/app/release-notes/releases.json)
and ship inside the bundle: they describe the code they are built with, so a
release can never claim a change the running build does not have, and the
page works offline and on a deployment with no API.

A change the player can see adds a line to `unreleased`, **in both
languages, in the pull request that makes the change** — the same habit as
updating the matching document in `docs/`. The moment to write it is while
the reason for the change is still in mind.

A line is written for the player:

- "A finished run can be shared as a picture." — yes.
- "Phase 23: `wq-dialog` replaces the inline panels." — no. That is what the
  commit message is for.

Both languages must have the same number of lines; the cut refuses otherwise,
and a release with one language short would show English to everyone.

## Cutting the release

```bash
npm run release              # 0.4 → 0.5: the waiting lines become 0.5, dated today
npm run release -- --amend   # add them to the newest entry instead
```

The script moves `unreleased` into a dated entry, clears it, and sets
`package.json` to the new series. `--amend` is for a release that was cut
but not deployed when more work landed on top of it; it is explicit, because
nothing in the repository can tell whether the last entry has gone out.

It **commits nothing on purpose**: the deploy stamps the bundle with the
commit it is built from, and an uncommitted change would stamp it `-dirty`.
So the cut is reviewed, committed, and only then deployed:

```bash
npm run release
git add apps/shell/src/app/release-notes/releases.json package.json
git commit -m "chore(release): 0.5"
npm run deploy:web
```

The `/release` skill (`.claude/skills/release/SKILL.md`) does the reading
part of this: it compares the commits since the last entry with what is
waiting in `unreleased` and writes the lines that are missing.

## What the player sees

- **The bell on Home** carries a mark while the build is a release the
  device has not read about. It holds a list — today one kind of message,
  and friends' challenges are the next thing to belong there.
- **Settings → What's new** is the same page with the same mark, for a
  player who never presses the bell.
- Opening the page is what clears the mark, in both places: reading is the
  thing the mark is about.
- A device with nothing stored is **level with the build it starts on**. A
  new player is not behind on a release they have never seen — which also
  means the first release after this screen shipped goes unannounced, and
  every release after it does not.

To see the mark on a device that is already up to date, store an older
series by hand (the browser's console, on the app's own origin):

```js
localStorage.setItem('CapacitorStorage.world-quiz.release.seen', '0.3');
```
