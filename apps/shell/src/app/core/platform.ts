import { InjectionToken } from '@angular/core';
import { Capacitor } from '@capacitor/core';

/**
 * Whether the app runs inside the native shell (the iPhone app) rather than
 * in a browser.
 *
 * It is a token, not a direct `Capacitor.isNativePlatform()` call, so screens
 * stay testable and every place that behaves differently on the device is
 * visible in one list of dependencies.
 */
export const NATIVE_PLATFORM = new InjectionToken<boolean>('NATIVE_PLATFORM', {
  providedIn: 'root',
  factory: () => Capacitor.isNativePlatform(),
});
