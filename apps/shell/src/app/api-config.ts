/**
 * Where the app finds the API and which Google client it signs in with.
 *
 * Both are public values (the browser sees them anyway). They are fixed for
 * local development here; per-environment values come with deployment
 * (Phase 12).
 */
export const API_URL = 'http://localhost:3333';

/** "World Quiz Web" in Google Auth Platform (origins: localhost:4200). */
export const GOOGLE_WEB_CLIENT_ID =
  '294520908592-vhhkau8mlstl3s1d105i3efqnopuu0nm.apps.googleusercontent.com';
