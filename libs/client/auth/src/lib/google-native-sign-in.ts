import { SocialLogin } from '@capgo/capacitor-social-login';
import { createNonce } from './google-identity';
import type { NativeCredential, NativeSignIn } from './native-sign-in';

/**
 * Google's sign-in on iOS, through the system (`@capgo/capacitor-social-login`
 * wraps Google's own iOS SDK). The app never sees the password: iOS shows
 * Google's sheet and returns an ID token.
 *
 * `iosClientId` is an **iOS** OAuth client of the same Google project as the
 * web client (Google Cloud Console → Credentials). Its reversed form is also
 * the URL scheme in `Info.plist`, which is how Google returns to the app.
 *
 * The API verifies the token's signature, issuer, audience and the nonce
 * below against Google's keys, so nothing here has to be trusted.
 */
export function googleNativeSignIn(iosClientId: string): NativeSignIn {
  // One initialization per app run, awaited by every sign-in.
  const ready = SocialLogin.initialize({
    google: { iOSClientId: iosClientId },
  });

  return {
    async signIn(): Promise<NativeCredential> {
      await ready;
      // A fresh nonce per attempt: the API rejects a token minted for
      // another one, so a token captured elsewhere cannot be replayed.
      const nonce = createNonce();
      const { result } = await SocialLogin.login({
        provider: 'google',
        options: { nonce, scopes: ['profile', 'email'] },
      });
      const idToken = 'idToken' in result ? result.idToken : null;
      if (!idToken) throw new Error('Google returned no ID token');
      return { provider: 'google', idToken, nonce };
    },
  };
}
