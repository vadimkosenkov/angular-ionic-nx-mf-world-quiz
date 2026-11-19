import {
  HttpClient,
  HttpErrorResponse,
  httpResource,
} from '@angular/common/http';
import {
  computed,
  effect,
  ErrorHandler,
  inject,
  Injectable,
  signal,
  untracked,
} from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { AUTH_CONFIG, AuthStore } from '@world-quiz/client/auth';
import { KEY_VALUE_STORAGE } from '@world-quiz/client/settings';
import { Toasts } from '@world-quiz/client/ui';
import {
  type Friend,
  type FriendRequestResult,
  friendRequestResultSchema,
  friendsSchema,
  inviteCodeSchema,
  normaliseInviteCode,
} from '@world-quiz/shared/contracts';
import { err, ok, type Result } from '@world-quiz/shared/util';
import { firstValueFrom, type Observable } from 'rxjs';

/** Where a code from an invite link waits until there is an account. */
export const PENDING_INVITE_STORAGE_KEY = 'world-quiz.invite.pending';

/** Why a request could not be sent, in the words the screen explains it in. */
export type FriendRequestError =
  /** Not eight characters of the invite alphabet. */
  | 'invalid-code'
  /** The player's own code: there is nobody on the other side. */
  | 'self'
  /** Nobody holds it. */
  | 'unknown-code'
  /** The API could not be reached, or would not answer. */
  | 'failed';

/**
 * Who the player knows (ADR-015).
 *
 * The lists are loaded as soon as somebody is signed in, because they are
 * news: Home's card and the bell both say how many people are waiting for
 * an answer, and both are on the first screen of the app.
 *
 * Mutations are plain calls that reload the lists rather than patching
 * them: the three lists move together (accepting a request empties one and
 * fills another), and the server is the one that knows what the result was.
 */
@Injectable({ providedIn: 'root' })
export class FriendsStore {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = inject(AUTH_CONFIG).apiUrl;
  private readonly auth = inject(AuthStore);
  private readonly storage = inject(KEY_VALUE_STORAGE);
  private readonly toasts = inject(Toasts);
  private readonly transloco = inject(TranslocoService);
  private readonly errorHandler = inject(ErrorHandler);

  private readonly busyState = signal(false);
  /**
   * Claims run one after another, never at the same time. Two things can
   * ask for one — an account appearing, and a link writing a code down —
   * and a flag that simply refused the second would lose the claim when
   * the first ran a moment too early and found nothing stored.
   */
  private claims = Promise.resolve();

  constructor() {
    // An invite link may be opened by somebody who has no account yet, so
    // the code waits in the device's storage and is sent the moment there
    // is somebody to send it from — which is this signal turning true.
    effect(() => {
      if (!this.auth.signedIn()) return;
      untracked(() => void this.claimInvite());
    });
  }

  /** The three lists, or nothing at all while nobody is signed in. */
  readonly lists = httpResource(
    () => (this.auth.signedIn() ? `${this.apiUrl}/v1/friends` : undefined),
    { parse: (body) => friendsSchema.parse(body) },
  );

  readonly friends = computed<readonly Friend[]>(() =>
    this.lists.hasValue() ? this.lists.value().friends : [],
  );
  /** People waiting for this player's answer. */
  readonly incoming = computed<readonly Friend[]>(() =>
    this.lists.hasValue() ? this.lists.value().incoming : [],
  );
  /** People this player has asked and nobody has answered yet. */
  readonly outgoing = computed<readonly Friend[]>(() =>
    this.lists.hasValue() ? this.lists.value().outgoing : [],
  );

  /** What the player hands over to be found; `null` until signed in. */
  readonly inviteCode = computed(() => this.auth.user()?.inviteCode ?? null);

  /** True while a request, an answer or a removal is in flight. */
  readonly busy = this.busyState.asReadonly();

  reload(): void {
    this.lists.reload();
  }

  /**
   * Writes down the code an invite link carried. It is the device's note to
   * itself, not the account's: whoever signs in on this device next is who
   * the request will come from.
   */
  async rememberInvite(code: string): Promise<void> {
    try {
      await this.storage.set(PENDING_INVITE_STORAGE_KEY, code);
    } catch (error) {
      this.errorHandler.handleError(error);
      return;
    }
    // A link opened by somebody who is already signed in: the effect that
    // watches for an account has long since run and found nothing, so this
    // is the moment to send the request — in the background, because the
    // page that wrote the code down is on its way somewhere and must not
    // wait for a round trip to get there. Claims are serialised, so the two
    // triggers cannot send the same code twice.
    if (this.auth.signedIn()) void this.claimInvite();
  }

  /**
   * Sends a remembered invite, once, and says what came of it.
   *
   * The code is forgotten before the request is sent: a code that cannot be
   * used — the player's own, a stranger who has deleted their account — must
   * not be retried on every start, and a request that failed is one the
   * player can send again from the screen.
   */
  private claimInvite(): Promise<void> {
    this.claims = this.claims.then(() => this.sendRememberedInvite());
    return this.claims;
  }

  /** One claim: reads what is stored now, and sends it if there is any. */
  private async sendRememberedInvite(): Promise<void> {
    try {
      const code = await this.storage.get(PENDING_INVITE_STORAGE_KEY);
      if (!code) return;
      await this.storage.remove(PENDING_INVITE_STORAGE_KEY);
      const outcome = await this.request(code);
      if (outcome.ok) {
        this.toasts.success(
          this.transloco.translate(
            outcome.value.status === 'accepted'
              ? 'friends.add.accepted'
              : 'friends.add.sent',
            { name: outcome.value.friend.nickname },
          ),
        );
      } else if (outcome.error !== 'self') {
        // Opening your own link is not a mistake worth a message.
        this.toasts.failure(
          this.transloco.translate(`friends.add.error.${outcome.error}`),
        );
      }
    } catch (error) {
      this.errorHandler.handleError(error);
    }
  }

  /**
   * Asks the owner of a code to be friends.
   *
   * The player's own code is refused **here**, before anything is sent: the
   * API refuses it too, but it is the one mistake the app can recognise on
   * its own, and it deserves an answer at once rather than a round trip.
   */
  async request(
    typed: string,
  ): Promise<Result<FriendRequestResult, FriendRequestError>> {
    const parsed = inviteCodeSchema.safeParse(typed);
    if (!parsed.success) return err('invalid-code');
    const code = parsed.data;
    if (code === normaliseInviteCode(this.inviteCode() ?? '')) {
      return err('self');
    }
    return this.run(async () => {
      try {
        const body = await firstValueFrom(
          this.http.post(`${this.apiUrl}/v1/friends/requests`, { code }),
        );
        this.lists.reload();
        return ok(friendRequestResultSchema.parse(body));
      } catch (error) {
        return err(
          error instanceof HttpErrorResponse && error.status === 404
            ? 'unknown-code'
            : 'failed',
        );
      }
    });
  }

  /** Accepts a waiting request; `false` when it could not be done. */
  accept(id: string): Promise<boolean> {
    return this.change(
      this.http.post(`${this.apiUrl}/v1/friends/${id}/accept`, {}),
    );
  }

  /** Declines a request or ends a friendship — the same call. */
  remove(id: string): Promise<boolean> {
    return this.change(this.http.delete(`${this.apiUrl}/v1/friends/${id}`));
  }

  private change(call: Observable<unknown>): Promise<boolean> {
    return this.run(async () => {
      try {
        await firstValueFrom(call);
        this.lists.reload();
        return true;
      } catch {
        return false;
      }
    });
  }

  private async run<T>(action: () => Promise<T>): Promise<T> {
    this.busyState.set(true);
    try {
      return await action();
    } finally {
      this.busyState.set(false);
    }
  }
}
