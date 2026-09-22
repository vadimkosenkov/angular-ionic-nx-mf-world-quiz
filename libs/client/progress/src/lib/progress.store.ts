import {
  computed,
  ErrorHandler,
  inject,
  Injectable,
  signal,
} from '@angular/core';
import { COUNTRY_DATASET } from '@world-quiz/client/quiz-ports';
import type { User } from '@world-quiz/shared/contracts';
import {
  evaluateAchievements,
  practiceCandidates,
  QUIZ_CATEGORIES,
  type QuizCategory,
  type QuizScope,
  type QuizSession,
  rebuildProgress,
  REGIONS,
  scopeProgress,
} from '@world-quiz/quiz/domain';
import { LOCAL_STORE, type LocalSession } from './local-store';
import { playedSession } from './session-mapping';

/**
 * The player's learning progress, kept on the device and exposed as signals.
 *
 * The state is the set of finished sessions — played here or pulled from the
 * account — and progress is **rebuilt** from their answers with the domain's
 * canonical order (`rebuildProgress`). Sessions from several devices can
 * therefore arrive in any order and still give the same mastery everywhere.
 *
 * Every change applies to the signals at once and is written to the
 * `LocalStore` in order; a failed write is reported, and the change still
 * holds for this run of the app (as `SettingsStore` does).
 */
@Injectable({ providedIn: 'root' })
export class ProgressStore {
  readonly dataset = inject(COUNTRY_DATASET);
  private readonly local = inject(LOCAL_STORE);
  private readonly errorHandler = inject(ErrorHandler);

  private readonly sessions = signal<ReadonlyMap<string, LocalSession>>(
    new Map(),
  );
  private readonly ownerState = signal<User | null>(null);
  private loading: Promise<void> | null = null;
  private writes: Promise<void> = Promise.resolve();

  /** The account the data on this device belongs to. */
  readonly owner = this.ownerState.asReadonly();

  private readonly progress = computed(() =>
    rebuildProgress(
      [...this.sessions().values()]
        .filter((session) => session.sync !== 'rejected')
        .flatMap((session) => session.events),
    ),
  );

  /** Current progress, for domain functions that take a `ProgressMap`. */
  readonly snapshot = this.progress;

  /** The outbox: sessions waiting to be sent, oldest first. */
  readonly pending = computed(() =>
    [...this.sessions().values()]
      .filter((session) => session.sync === 'pending')
      .sort((a, b) => a.finishedAt - b.finishedAt),
  );
  readonly pendingCount = computed(() => this.pending().length);
  /** Sessions the API refused; they do not count towards progress. */
  readonly rejectedCount = computed(
    () =>
      [...this.sessions().values()].filter(
        (session) => session.sync === 'rejected',
      ).length,
  );

  readonly countryCount = this.dataset.length;
  readonly regionCount = REGIONS.filter((region) =>
    this.dataset.some((country) => country.region === region),
  ).length;

  readonly achievements = computed(() =>
    evaluateAchievements(this.dataset, this.progress()),
  );

  readonly unlockedAchievements = computed(
    () =>
      this.achievements().filter((entry) => entry.status === 'unlocked').length,
  );

  /** Mastered countries per category for the whole world. */
  readonly worldProgress = computed(
    () =>
      Object.fromEntries(
        QUIZ_CATEGORIES.map((category) => [
          category,
          scopeProgress(this.dataset, this.progress(), category, 'world'),
        ]),
      ) as Record<QuizCategory, ReturnType<typeof scopeProgress>>,
  );

  /** Capitals + Flags mastered, out of both categories combined. */
  readonly combinedProgress = computed(() => {
    const perCategory = Object.values(this.worldProgress());
    const mastered = perCategory.reduce(
      (sum, entry) => sum + entry.mastered,
      0,
    );
    const total = perCategory.reduce((sum, entry) => sum + entry.total, 0);
    return {
      mastered,
      total,
      percent: total === 0 ? 0 : Math.round((mastered / total) * 100),
    };
  });

  readonly mistakeCount = computed(() =>
    QUIZ_CATEGORIES.reduce(
      (sum, category) =>
        sum +
        practiceCandidates(this.dataset, this.progress(), category).length,
      0,
    ),
  );

  scope(category: QuizCategory, scope: QuizScope) {
    return scopeProgress(this.dataset, this.progress(), category, scope);
  }

  /** Reads the device's data once; later calls wait for the same read. */
  load(): Promise<void> {
    this.loading ??= Promise.all([
      this.local.readOwner(),
      this.local.readSessions(),
    ])
      .then(([owner, stored]) => {
        // Changes made while reading (a session recorded meanwhile) win over
        // what was on disk; their writes are already queued.
        if (!this.ownerState()) this.ownerState.set(owner);
        this.sessions.update(
          (current) =>
            new Map([...stored.map((s) => [s.id, s] as const), ...current]),
        );
      })
      .catch((error: unknown) => this.errorHandler.handleError(error));
    return this.loading;
  }

  /**
   * Makes `user` the owner of the device's data. Another account's data is
   * deleted first, so it is never shown to, or sent as, this player.
   */
  async claim(user: User): Promise<void> {
    await this.load();
    const previous = this.ownerState();
    if (previous && previous.id !== user.id) await this.forget();
    this.ownerState.set(user);
    this.persist(() => this.local.writeOwner(user));
    await this.writes;
  }

  /**
   * Records a session finished on this device: progress updates at once, and
   * the session joins the outbox. Returns it, as stored.
   */
  recordSession(
    session: QuizSession,
    context: { readonly challengeId?: string } = {},
  ): LocalSession {
    const played = playedSession(
      session,
      crypto.randomUUID(),
      context.challengeId,
    );
    this.update([played]);
    this.persist(() => this.local.putSessions([played]));
    return played;
  }

  /** The API recorded these sessions. */
  markSynced(ids: readonly string[]): void {
    this.changeSync(ids, 'synced');
  }

  /** The API refused these sessions; they stop counting towards progress. */
  markRejected(ids: readonly string[]): void {
    this.changeSync(ids, 'rejected');
  }

  /** Where the last pull from the account's history ended. */
  async historyCursor(): Promise<string | null> {
    await this.writes;
    return this.local.readCursor();
  }

  /**
   * Adds a page of the account's history. Sessions this device already has
   * (its own, sent earlier) are kept as they are and count as synced.
   */
  async addPulledPage(
    pulled: readonly LocalSession[],
    cursor: string | null,
  ): Promise<void> {
    const current = this.sessions();
    const added = pulled.filter((session) => !current.has(session.id));
    const confirmed = pulled
      .map((session) => current.get(session.id))
      .filter(isDefined)
      .filter((session) => session.sync !== 'synced')
      .map((session) => ({ ...session, sync: 'synced' as const }));
    const changed = [...added, ...confirmed];
    this.update(changed);
    this.persist(() => this.local.savePulledPage(changed, cursor));
    await this.writes;
  }

  /** Deletes everything this device keeps: owner, sessions and outbox. */
  async forget(): Promise<void> {
    this.ownerState.set(null);
    this.sessions.set(new Map());
    this.persist(() => this.local.clear());
    await this.writes;
  }

  private changeSync(ids: readonly string[], sync: LocalSession['sync']) {
    const current = this.sessions();
    const changed = ids
      .map((id) => current.get(id))
      .filter(isDefined)
      .map((session) => ({ ...session, sync }));
    this.update(changed);
    this.persist(() => this.local.putSessions(changed));
  }

  private update(changed: readonly LocalSession[]): void {
    if (changed.length === 0) return;
    this.sessions.update((current) => {
      const next = new Map(current);
      for (const session of changed) next.set(session.id, session);
      return next;
    });
  }

  /** Writes run one after another, in the order the changes were made. */
  private persist(write: () => Promise<void>): void {
    this.writes = this.writes
      .then(write)
      .catch((error: unknown) => this.errorHandler.handleError(error));
  }
}

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}
