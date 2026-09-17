import { addIcons } from 'ionicons';
import {
  business,
  businessOutline,
  checkmarkCircle,
  flag,
  flagOutline,
  home,
  homeOutline,
  lockClosedOutline,
  moonOutline,
  phonePortraitOutline,
  podiumOutline,
  settings,
  settingsOutline,
  sparklesOutline,
  star,
  starOutline,
  sunnyOutline,
  timeOutline,
  trophy,
  trophyOutline,
} from 'ionicons/icons';

/**
 * Registers the icons the shell uses. Ionicons are SVGs bundled with the app
 * (no CDN), so they also work offline. Only registered icons are shipped.
 */
export function registerIcons(): void {
  addIcons({
    business,
    'business-outline': businessOutline,
    'checkmark-circle': checkmarkCircle,
    flag,
    'flag-outline': flagOutline,
    home,
    'home-outline': homeOutline,
    'lock-closed-outline': lockClosedOutline,
    'moon-outline': moonOutline,
    'phone-portrait-outline': phonePortraitOutline,
    'podium-outline': podiumOutline,
    settings,
    'settings-outline': settingsOutline,
    'sparkles-outline': sparklesOutline,
    star,
    'star-outline': starOutline,
    'sunny-outline': sunnyOutline,
    'time-outline': timeOutline,
    trophy,
    'trophy-outline': trophyOutline,
  });
}
