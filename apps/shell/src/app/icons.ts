import { registerQuizIcons } from '@world-quiz/client/quiz-feature';
import { addIcons } from 'ionicons';
import {
  arrowForward,
  business,
  businessOutline,
  chevronForward,
  cloudOfflineOutline,
  flag,
  flagOutline,
  globeOutline,
  home,
  homeOutline,
  infiniteOutline,
  logoApple,
  logoGoogle,
  listOutline,
  lockClosedOutline,
  moonOutline,
  personCircle,
  phonePortraitOutline,
  podiumOutline,
  refreshOutline,
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
    'chevron-forward': chevronForward,
    'cloud-offline-outline': cloudOfflineOutline,
    flag,
    'flag-outline': flagOutline,
    'globe-outline': globeOutline,
    home,
    'home-outline': homeOutline,
    'infinite-outline': infiniteOutline,
    'logo-apple': logoApple,
    'logo-google': logoGoogle,
    'list-outline': listOutline,
    'lock-closed-outline': lockClosedOutline,
    'moon-outline': moonOutline,
    'person-circle': personCircle,
    'phone-portrait-outline': phonePortraitOutline,
    'podium-outline': podiumOutline,
    'refresh-outline': refreshOutline,
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
