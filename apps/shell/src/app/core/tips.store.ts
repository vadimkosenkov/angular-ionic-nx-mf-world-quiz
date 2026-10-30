import {
  computed,
  type EnvironmentProviders,
  ErrorHandler,
  inject,
  Injectable,
  makeEnvironmentProviders,
  provideAppInitializer,
  signal,
} from '@angular/core';
import { KEY_VALUE_STORAGE } from '@world-quiz/client/settings';

/** Every guided tour the app can show, each shown until it is walked. */
export const TIPS = ['setup'] as const;
export type TipId = (typeof TIPS)[number];

export const TIPS_STORAGE_KEY = 'world-quiz.tips.seen';
export const TIPS_ENABLED_STORAGE_KEY = 'world-quiz.tips.enabled';

/**
 * Whether a screen still has a tour to give, and which ones are behind the
 * player.
 *
 * Two things are remembered, because they answer different questions. What
 * has been **seen** is the app's own bookkeeping. Whether tours are
 * **enabled** is the player's wish, kept apart so that turning them off
 * also turns off tours added in a later release.
 *
 * Settings shows one switch for both (`on`), which reads as a statement
 * about what will happen: "a tour is still going to appear somewhere". So
 * it turns itself off once the last tour has been walked — nothing is going
 * to appear any more — and turning it back on starts them all again.
 *
 * All of it belongs to the device, not to the account: it is about having
 * read a few sentences, and a player who signs out has still read them.
 * That is why it uses the same key-value storage as the settings
 * (`KEY_VALUE_STORAGE`, Capacitor Preferences) rather than the account's
 * own data, which `ProgressStore.forget()` wipes on sign-out.
 *
 * Nothing here throws: storage that cannot be read or written costs the
 * player a tour shown once more, which is not worth failing a screen for.
 */
@Injectable({ providedIn: 'root' })
export class TipsStore {
  private readonly storage = inject(KEY_VALUE_STORAGE);
  private readonly errorHandler = inject(ErrorHandler);

  private readonly seenState = signal<readonly TipId[]>([]);
  private readonly enabledState = signal(true);
  private pendingWrite: Promise<void> = Promise.resolve();

  /** Whether any tour is still going to be shown: the switch's position. */
  readonly on = computed(
    () => this.enabledState() && this.seenState().length < TIPS.length,
  );

  /** Whether this screen's tour still has something to show the player. */
  shows(tip: TipId): boolean {
    return this.enabledState() && !this.seenState().includes(tip);
  }

  /** Loads what has been seen and whether tours are wanted, once, at start. */
  async load(): Promise<void> {
    try {
      const [seen, enabled] = await Promise.all([
        this.storage.get(TIPS_STORAGE_KEY),
        this.storage.get(TIPS_ENABLED_STORAGE_KEY),
      ]);
      this.seenState.set(parseSeenTips(seen));
      // Anything but an explicit "off" means the player has never said no.
      this.enabledState.set(enabled !== 'false');
    } catch (error) {
      this.errorHandler.handleError(error);
    }
  }

  /** The player has walked this tour (or shown they did not need it). */
  dismiss(tip: TipId): void {
    if (!this.shows(tip)) return;
    this.seenState.update((seen) => [...seen, tip]);
    this.persist();
  }

  /**
   * The switch in Settings. Turning it on means "show them again", so what
   * has been seen is forgotten; turning it off means "none of them", for
   * the tours that are left and for any added later.
   */
  setOn(on: boolean): void {
    this.enabledState.set(on);
    if (on) this.seenState.set([]);
    this.persist();
  }

  /** Writes in order, so the last change is the one that survives. */
  private persist(): void {
    const seen = JSON.stringify(this.seenState());
    const enabled = String(this.enabledState());
    this.pendingWrite = this.pendingWrite
      .then(() => this.storage.set(TIPS_STORAGE_KEY, seen))
      .then(() => this.storage.set(TIPS_ENABLED_STORAGE_KEY, enabled))
      .catch((error: unknown) => this.errorHandler.handleError(error));
  }
}

/** Unknown or damaged values mean "nothing seen yet", never a crash. */
export function parseSeenTips(raw: string | null): readonly TipId[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((value): value is TipId =>
      (TIPS as readonly unknown[]).includes(value),
    );
  } catch {
    return [];
  }
}

/**
 * Loads the tours before the first render, so one the player walked long
 * ago does not appear for a frame on the way back to the screen.
 */
export function provideTips(): EnvironmentProviders {
  return makeEnvironmentProviders([
    provideAppInitializer(() => inject(TipsStore).load()),
  ]);
}
