# ADR-011: Sign-in is required before playing

## Status

Accepted (2026-09-22), implemented in Phase 8b (`feat/sync-client`). To be
reviewed against App Store review before the iOS release (Phase 13).

## Context

- The product was designed around an account: progress and mistakes follow
  the player across devices, leaderboards and personal records are per
  player (Phase 9).
- Until Phase 8b the app could be played signed out, keeping progress only in
  memory.
- Supporting guests as well would mean a second owner for local data and a
  rule for moving a guest's results into an account.

## Decision

- The app opens on a **welcome screen** (`/welcome`) with sign-in. The tabs
  and quizzes are behind `signedInGuard`; the welcome screen sends a player
  who may already play to `/home` (`signedOutGuard`).
- **Offline after a first sign-in still works**: when the API cannot be
  reached at start-up (`unverified`, ADR-010), a player whose account owns
  the data on the device may play; results wait in the outbox (ADR-006).
- When a sign-in ends (sign-out, account deletion, refresh refused), the app
  returns to the welcome screen with a new navigation root, so Ionic drops
  the cached pages of the previous player.

## Alternatives

| Alternative                                   | Why not                                                                                   |
| --------------------------------------------- | ----------------------------------------------------------------------------------------- |
| **Guest play, sign in later** (adopt results) | More states and data ownership rules; not the product intent                              |
| **Browse signed out, sign in to play**        | Empty progress screens before sign-in are of little use; one clear entry point is simpler |

## Consequences

- Every local session has an owner; no guest data exists.
- The first launch needs a network connection.
- E2E tests sign in (development sign-in) before every journey.
- **App Store risk:** guideline 5.1.1(v) asks apps to let people use
  features that do not need an account without signing in. The account-based
  features here (cross-device progress, leaderboards, personal records)
  justify requiring it, but reviewers can disagree. If they do, guest play
  can be added: the data layer already separates the device's data by owner.
