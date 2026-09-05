/**
 * Only present inside the real Electron desktop app — exposed by
 * apps/desktop/src-ts/preload.ts's contextBridge. Undefined everywhere
 * else (the hosted web app, browser dev tools), hence optional.
 */
export {};

declare global {
  interface Window {
    cybarDesktop?: {
      restartApp: () => void;
    };
  }
}
