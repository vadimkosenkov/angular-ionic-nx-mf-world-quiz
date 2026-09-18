import { addIcons } from 'ionicons';
import {
  checkmarkCircle,
  close,
  closeCircle,
  sparklesOutline,
  trophy,
} from 'ionicons/icons';

/**
 * Registers the icons the quiz screens use.
 *
 * Ionicons keeps one global registry, and only registered icons are bundled.
 * Every application that shows these components calls this once at startup —
 * the shell for the federated case, the remote's dev app when it runs alone.
 */
export function registerQuizIcons(): void {
  addIcons({
    'checkmark-circle': checkmarkCircle,
    close,
    'close-circle': closeCircle,
    'sparkles-outline': sparklesOutline,
    trophy,
  });
}
