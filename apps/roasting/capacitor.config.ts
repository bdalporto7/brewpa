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
  },
};

export default config;
