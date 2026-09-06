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
      /**
       * Opens the hosted app's /desktop/pair page in the system browser and
       * remembers a nonce to verify against the cybarcoffee:// callback —
       * see apps/desktop/src-ts/main.ts's handlePairingCallback. Resolves
       * once the browser has been opened, not once pairing completes (that
       * arrives later, out of band, as a full app relaunch).
       */
      startSyncPairing: () => void;
      /** Clears this install's SyncToken/synced identity and relaunches back to local-only/guest mode. */
      disableSync: () => void;
    };
  }
}
