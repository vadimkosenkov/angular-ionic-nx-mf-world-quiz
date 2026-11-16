---
name: release
description: Writes the release notes for World Quiz and cuts a release. Use when the user is about to deploy ("деплой", "выкатываем", "cut a release", "release notes"), when `npm run deploy:web` refuses because lines are waiting, or when asking what changed since the last release.
---

# Release

Turns the commits since the last release into lines a player can read, then
cuts the release. The full rules are in
[docs/deployment/releasing.md](../../../docs/deployment/releasing.md); this
is the procedure.

## 1. See what is already written down

```bash
cat apps/shell/src/app/release-notes/releases.json
```

`unreleased` holds the lines waiting for the next release; `releases[0]` is
the newest one that has gone out.

## 2. See what has happened since

```bash
git log --oneline "$(git log -1 --format=%H -- apps/shell/src/app/release-notes/releases.json)"..HEAD
```

If that is empty or misleading (the file was touched for another reason),
fall back to the date of `releases[0]`:

```bash
git log --oneline --since=<date of releases[0]>
```

## 3. Write the missing lines

For every commit that changed something **the player can see**, check that
`unreleased` says so. Add what is missing, in English and Russian, keeping
the two arrays the same length.

- Write what the player can now do, not what was built: "A finished run can
  be shared as a picture", not "`wq-dialog` replaces the inline panels".
- One line per change the player would notice. A refactor, a test, a
  document or a CI change is not news and gets no line.
- Keep the wording plain. If a line needs a term from the codebase to make
  sense, it is the wrong line.
- Match the tone of the entries already in the file.

Ask the user before inventing a line for a commit whose visible effect is
unclear — a guess in a release note is a lie to the player.

## 4. Cut it

```bash
npm run release              # a new series: 0.4 → 0.5
npm run release -- --amend   # add to a release that was cut but not deployed
```

Then show the user the diff of `releases.json` and `package.json` and stop:
committing and deploying are theirs (CLAUDE.md), and the deploy must run
from a clean tree or the build stamp says `-dirty`.

## When there is nothing to say

A deploy that changes nothing the player sees does not get a release. Tell
the user to deploy with:

```bash
npm run deploy:web:no-note
```
