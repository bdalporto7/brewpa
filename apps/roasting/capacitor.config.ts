import type { CapacitorConfig } from '@capacitor/cli';

/**
 * This app is server-rendered (Server Actions, live auth, real-time data)
 * — not a static site — so there's nothing meaningful to bundle into the
 * app itself the usual Capacitor way. Instead the native WebView just
 * loads the real deployed URL directly, same as Safari would; `webDir`
 * ("www/") only holds a trivial placeholder Capacitor's CLI requires to
 * exist, and is never what's actually shown once the app opens.
 */
const config: CapacitorConfig = {
  appId: 'com.cybar.roasting',
  appName: 'Cybar Coffee',
  webDir: 'www',
  server: {
    url: 'https://roasting-three.vercel.app',
    cleartext: false,
    /**
     * Without this, Capacitor pops navigation to accounts.google.com /
     * github.com out of the app's own WebView into a separate browser
     * context with its own cookie jar. Auth.js sets a PKCE verification
     * cookie right before that redirect; when the OAuth callback lands
     * back in the app's *main* WebView (a different cookie jar), that
     * cookie is invisible and sign-in fails server-side with
     * "InvalidCheck: pkceCodeVerifier value could not be parsed" — found
     * by reading the actual Vercel logs for a real failed sign-in, not by
     * guessing. Allowing these domains keeps the whole OAuth flow in one
     * WebView, so the cookie survives the redirect.
     */
    allowNavigation: ['accounts.google.com', 'github.com'],
  },
};

export default config;
