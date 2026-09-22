import { registerQuizIcons } from '@world-quiz/client/quiz-feature';
import { addIcons } from 'ionicons';
import {
  arrowForward,
  business,
  businessOutline,
  flag,
  flagOutline,
  home,
  homeOutline,
  infiniteOutline,
  logoApple,
  listOutline,
  lockClosedOutline,
  moonOutline,
  personCircle,
  phonePortraitOutline,
  podiumOutline,
  settings,
  settingsOutline,
  star,
  starOutline,
  sunnyOutline,
  timeOutline,
  timerOutline,
  trophyOutline,
} from 'ionicons/icons';

/**
 * Registers the icons the shell uses. Ionicons are SVGs bundled with the app
 * (no CDN), so they also work offline. Only registered icons are shipped.
 */
export function registerIcons(): void {
  // The quiz screens live in a library that both the shell and the remotes
  // use, so they register their own icons.
  registerQuizIcons();

  addIcons({
    'arrow-forward': arrowForward,
    business,
    'business-outline': businessOutline,
    flag,
    'flag-outline': flagOutline,
    home,
    'home-outline': homeOutline,
    'infinite-outline': infiniteOutline,
    'logo-apple': logoApple,
    'list-outline': listOutline,
    'lock-closed-outline': lockClosedOutline,
    'moon-outline': moonOutline,
    'person-circle': personCircle,
    'phone-portrait-outline': phonePortraitOutline,
    'podium-outline': podiumOutline,
    settings,
    'settings-outline': settingsOutline,
    star,
    'star-outline': starOutline,
    'sunny-outline': sunnyOutline,
    'time-outline': timeOutline,
    'timer-outline': timerOutline,
    'trophy-outline': trophyOutline,
  });
}
