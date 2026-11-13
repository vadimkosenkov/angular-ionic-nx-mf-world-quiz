import { InjectionToken } from '@angular/core';

/** What a share hands to the system. */
export interface SharePayload {
  /** The sheet's own heading; some targets use it as a subject line. */
  readonly title: string;
  /** The message itself, already in the player's language. */
  readonly text: string;
  /** Where to play: omitted when the deployment does not know its address. */
  readonly url?: string;
  /**
   * The picture to share instead of the bare text, drawn only when the
   * device can actually take a file: painting costs a few milliseconds and
   * a desktop Safari would throw it away. Answering `null` (no canvas, an
   * old WebView) simply shares the text.
   */
  readonly image?: () => Promise<File | null>;
}

/**
 * What became of a share.
 *
 * `cancelled` is the player closing the sheet. It is not a failure and must
 * not be reported as one — they decided not to send it, which is an answer.
 */
export type ShareOutcome = 'shared' | 'copied' | 'cancelled' | 'failed';

export interface ShareTarget {
  share(payload: SharePayload): Promise<ShareOutcome>;
}

/** The part of `navigator` this needs, so a test can hand over its own. */
interface ShareCapableNavigator {
  share?: (data: ShareData) => Promise<void>;
  /** Only a browser that can share files has this; it is asked first. */
  canShare?: (data: ShareData) => boolean;
  clipboard?: { writeText?: (text: string) => Promise<void> };
}

/**
 * Joins the lines of a shared message, leaving out what a run has nothing to
 * say about (no rank, no address). The caller passes translated lines, since
 * `client/ui` holds no translations.
 */
export function shareLines(
  ...lines: readonly (string | null | undefined)[]
): string {
  return lines
    .map((line) => line?.trim())
    .filter((line): line is string => !!line)
    .join('\n');
}

/**
 * Sharing through the browser, with the clipboard as the fallback.
 *
 * `navigator.share` opens the system sheet and exists on phones and on
 * Safari; a desktop Chrome or Firefox has no sheet, so the message is copied
 * instead and the screen says so. A share that throws for any other reason
 * than the player cancelling also falls back to the clipboard: the player
 * asked for the text, and they can still paste it.
 *
 * A picture is offered first, and only where `canShare` says the very data
 * about to be sent is acceptable — iOS takes files, desktop Safari and
 * Firefox do not, and a browser that refuses answers `false` instead of
 * throwing halfway. The address travels inside the text there: a sheet that
 * carries a file may drop a separate `url`.
 */
export function browserShareTarget(
  target: ShareCapableNavigator | undefined = typeof navigator === 'undefined'
    ? undefined
    : navigator,
): ShareTarget {
  return {
    async share(payload: SharePayload): Promise<ShareOutcome> {
      if (target?.share) {
        const withImage = await imageShareData(target, payload);
        const data: ShareData = withImage ?? {
          title: payload.title,
          text: payload.text,
          ...(payload.url ? { url: payload.url } : {}),
        };
        try {
          await target.share(data);
          return 'shared';
        } catch (error) {
          if ((error as { name?: string } | null)?.name === 'AbortError') {
            return 'cancelled';
          }
        }
      }

      const writeText = target?.clipboard?.writeText;
      if (writeText) {
        try {
          // The sheet carries the address in its own field; the clipboard is
          // one string, so it has to be part of the text.
          await writeText.call(
            target?.clipboard,
            shareLines(payload.text, payload.url),
          );
          return 'copied';
        } catch {
          return 'failed';
        }
      }
      return 'failed';
    },
  };
}

/**
 * The data of a share that carries the picture, or `null` when this device
 * cannot take one — the picture is painted only after `canShare` has said
 * that a file would be accepted at all.
 */
async function imageShareData(
  target: ShareCapableNavigator,
  payload: SharePayload,
): Promise<ShareData | null> {
  if (!payload.image || !target.canShare) return null;
  const probe = new File([], 'probe.png', { type: 'image/png' });
  if (!safely(() => target.canShare?.({ files: [probe] }) ?? false)) {
    return null;
  }
  const file = await payload.image();
  if (!file) return null;
  const data: ShareData = {
    files: [file],
    title: payload.title,
    text: shareLines(payload.text, payload.url),
  };
  return safely(() => target.canShare?.(data) ?? false) ? data : null;
}

/** `canShare` throws on some engines when handed data they dislike. */
function safely(check: () => boolean): boolean {
  try {
    return check();
  } catch {
    return false;
  }
}

/**
 * Defaults to the browser, so a component needs no provider; a test or a
 * server render replaces it (there, `navigator` is missing and every share
 * answers `failed` rather than throwing).
 */
export const SHARE_TARGET = new InjectionToken<ShareTarget>('SHARE_TARGET', {
  providedIn: 'root',
  factory: () => browserShareTarget(),
});
