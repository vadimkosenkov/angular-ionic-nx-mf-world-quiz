import {
  Haptics as CapacitorHaptics,
  ImpactStyle,
  NotificationType,
} from '@capacitor/haptics';
import type { FeedbackEvent, Haptics } from './feedback';

/**
 * The iPhone's taptic engine, through Capacitor.
 *
 * iOS distinguishes an *impact* (something was touched) from a
 * *notification* (something succeeded or failed), and its own apps use them
 * that way, so an answer feels like a tap and the end of a round like an
 * outcome.
 */
export function capacitorHaptics(): Haptics {
  return {
    tap(event: FeedbackEvent) {
      switch (event) {
        case 'correct':
          return CapacitorHaptics.impact({ style: ImpactStyle.Light });
        case 'incorrect':
          return CapacitorHaptics.notification({
            type: NotificationType.Warning,
          });
        case 'finished':
          return CapacitorHaptics.impact({ style: ImpactStyle.Medium });
        case 'celebrate':
          return CapacitorHaptics.notification({
            type: NotificationType.Success,
          });
      }
    },
  };
}

/** The web: browsers have no taptic engine, and `vibrate` is not one. */
export const noHaptics: Haptics = { tap: () => Promise.resolve() };
