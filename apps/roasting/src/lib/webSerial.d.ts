/**
 * Minimal ambient types for the Web Serial API surface this app actually
 * uses (src/components/roasts/WebSerialProbeConnector.tsx) — Chromium-only,
 * not in TS's default DOM lib, and not worth pulling in a whole @types
 * package for six methods/fields. Kept deliberately narrow: extend this
 * only if a new call site needs another part of the real spec.
 */
export {};

declare global {
  interface SerialPortInfo {
    usbVendorId?: number;
    usbProductId?: number;
  }

  interface SerialOptions {
    baudRate: number;
  }

  interface SerialPort {
    readonly readable: ReadableStream<Uint8Array> | null;
    /** Only needed by Modbus RTU (request/response) — the free-running Mastech connector never writes. */
    readonly writable: WritableStream<Uint8Array> | null;
    open(options: SerialOptions): Promise<void>;
    close(): Promise<void>;
    /** Revokes this origin's permission grant for the port — without this, closing a port only pauses the connection; getPorts() would still list it and the mount-time auto-reconnect would pick it right back up on the next page load. */
    forget(): Promise<void>;
    getInfo(): SerialPortInfo;
  }

  interface Serial extends EventTarget {
    requestPort(options?: { filters?: SerialPortInfo[] }): Promise<SerialPort>;
    getPorts(): Promise<SerialPort[]>;
  }

  interface Navigator {
    serial?: Serial;
  }
}
