import {
  type EnvironmentProviders,
  ErrorHandler,
  inject,
  Injectable,
  makeEnvironmentProviders,
  provideAppInitializer,
  signal,
} from '@angular/core';
import { KEY_VALUE_STORAGE } from '@world-quiz/client/settings';
import {
  type Difficulty,
  isDifficulty,
  isQuizCategory,
  isQuizMode,
  isQuizScope,
  isRankedMode,
  type QuizCategory,
  type QuizScope,
  type QuizMode,
  type RankedMode,
} from '@world-quiz/quiz/domain';

/** The four choices the setup screen makes, as the player last left them. */
export interface RememberedSetup {
  readonly category: QuizCategory;
  readonly scope: QuizScope;
  readonly difficulty: Difficulty;
  readonly mode: QuizMode;
}

/**
 * The four choices the leaderboard screen makes. The same four questions,
 * with one difference: only a ranked mode has a board, so `practice` and
 * `endless` cannot be remembered here.
 */
export interface RememberedBoard extends Omit<RememberedSetup, 'mode'> {
  readonly mode: RankedMode;
}

export const LAST_SETUP_STORAGE_KEY = 'world-quiz.setup.last';
export const LAST_BOARD_STORAGE_KEY = 'world-quiz.board.last';

/** What the setup screen shows a player who has never started a quiz. */
export const DEFAULT_SETUP: RememberedSetup = {
  category: 'capitals',
  scope: 'world',
  difficulty: 'easy',
  mode: 'fixed',
};

/** What the leaderboard shows a player who has never opened a board. */
export const DEFAULT_BOARD: RememberedBoard = {
  category: 'capitals',
  scope: 'world',
  difficulty: 'easy',
  mode: 'fixed',
};

/**
 * The setup a player last started a quiz with, and the board they last
 * looked at.
 *
 * Home has one Play button now, and it opens the setup screen rather than a
 * quiz, so the screen has to arrive already saying what the player plays:
 * answering the same four questions before every round is the kind of work
 * an app should do once.
 *
 * The leaderboard asks the same four questions, so it is remembered the
 * same way and in the same place — but **separately**: a player who plays
 * Europe on Hard may well be looking at the World board of the easy Quick
 * round, and one choice overwriting the other would move the ground under
 * whichever screen they open next.
 *
 * **Practice Mistakes is deliberately not remembered.** It is an action, not
 * a preference — it needs mistakes to exist, and a player who practised once
 * should not find Start disabled next time because there is nothing left to
 * review. Only the three training modes are kept.
 *
 * Like the tours, this belongs to the device and not to the account
 * (`KEY_VALUE_STORAGE`, Capacitor Preferences): it is a convenience about
 * this phone, and signing out does not make the player want a different
 * region. Nothing here throws — storage that cannot be read or written costs
 * the player one pre-filled screen, which is not worth failing a screen for.
 */
@Injectable({ providedIn: 'root' })
export class LastSetupStore {
  private readonly storage = inject(KEY_VALUE_STORAGE);
  private readonly errorHandler = inject(ErrorHandler);

  private readonly state = signal<RememberedSetup>(DEFAULT_SETUP);
  private readonly boardState = signal<RememberedBoard>(DEFAULT_BOARD);
  private pendingWrite: Promise<void> = Promise.resolve();

  /** The choices the setup screen opens with. Never partial. */
  readonly setup = this.state.asReadonly();
  /** The choices the leaderboard's board picker opens with. */
  readonly board = this.boardState.asReadonly();

  /** Loads both remembered choices once, before the first render. */
  async load(): Promise<void> {
    try {
      const [setup, board] = await Promise.all([
        this.storage.get(LAST_SETUP_STORAGE_KEY),
        this.storage.get(LAST_BOARD_STORAGE_KEY),
      ]);
      this.state.set(parseSetup(setup));
      this.boardState.set(parseBoard(board));
    } catch (error) {
      this.errorHandler.handleError(error);
    }
  }

  /** The player started a quiz with these choices. */
  remember(setup: RememberedSetup): void {
    this.state.set(setup);
    this.write(LAST_SETUP_STORAGE_KEY, setup);
  }

  /** The player asked to see this board. */
  rememberBoard(board: RememberedBoard): void {
    this.boardState.set(board);
    this.write(LAST_BOARD_STORAGE_KEY, board);
  }

  private write(key: string, value: RememberedSetup | RememberedBoard): void {
    const json = JSON.stringify(value);
    this.pendingWrite = this.pendingWrite
      .then(() => this.storage.set(key, json))
      .catch((error: unknown) => this.errorHandler.handleError(error));
  }
}

/**
 * A stored value is only as good as the release that wrote it: a region that
 * no longer exists, or a mode that was renamed, must not leave the screen in
 * a state it cannot show. Every field is checked on its own against the
 * domain's own guards, so one stale field costs only that field.
 */
export function parseSetup(raw: string | null): RememberedSetup {
  if (!raw) return DEFAULT_SETUP;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return DEFAULT_SETUP;
    const value = parsed as Partial<Record<keyof RememberedSetup, unknown>>;
    return {
      category: isQuizCategory(value.category)
        ? value.category
        : DEFAULT_SETUP.category,
      scope: isQuizScope(value.scope) ? value.scope : DEFAULT_SETUP.scope,
      difficulty: isDifficulty(value.difficulty)
        ? value.difficulty
        : DEFAULT_SETUP.difficulty,
      mode: isQuizMode(value.mode) ? value.mode : DEFAULT_SETUP.mode,
    };
  } catch {
    return DEFAULT_SETUP;
  }
}

/** The same per-field check for a board, whose mode must be a ranked one. */
export function parseBoard(raw: string | null): RememberedBoard {
  const { category, scope, difficulty, mode } = parseSetup(raw);
  return {
    category,
    scope,
    difficulty,
    mode: isRankedMode(mode) ? mode : DEFAULT_BOARD.mode,
  };
}

/**
 * Loads the remembered choices before the first render, so the screen never
 * shows the defaults for a frame and then rearranges itself.
 */
export function provideLastSetup(): EnvironmentProviders {
  return makeEnvironmentProviders([
    provideAppInitializer(() => inject(LastSetupStore).load()),
  ]);
}
