import { SerialPort } from "serialport";

/**
 * Same Mastech MS6514 protocol as apps/roasting/scripts/probe_bridge.py —
 * ported line-for-line, not reinvented, since that byte layout was
 * reverse-engineered against real hardware and cross-checked against
 * Artisan's own open-source parser (see that script's own header comment
 * for the full story). This replaces the separate manually-run Python
 * script for the desktop build specifically: same protocol, same POST
 * target, just running inside the same process as the app itself instead
 * of a second thing you have to remember to start.
 */
const BAUD = 9600;
const FRAME_LEN = 18;
const RECONNECT_DELAY_MS = 3000;

function findFrame(buf: Buffer<ArrayBufferLike>): { frame: Buffer | null; rest: Buffer<ArrayBufferLike> } {
  const idx = buf.indexOf(Buffer.from([0x65, 0x14]));
  if (idx === -1 || buf.length < idx + FRAME_LEN) return { frame: null, rest: buf };
  const frame = buf.subarray(idx, idx + FRAME_LEN);
  if (frame[16] !== 0x0d || frame[17] !== 0x0a) {
    // Header matched by coincidence mid-payload — drop past it and let the
    // next search try again further along, same as the Python version.
    return { frame: null, rest: buf.subarray(idx + 2) };
  }
  return { frame: Buffer.from(frame), rest: buf.subarray(idx + FRAME_LEN) };
}

function parseTempF(frame: Buffer): number {
  return (frame[5] * 256 + frame[6]) / 10;
}

export interface ProbeBridgeOptions {
  /** e.g. /dev/cu.usbserial-0001 (macOS) — same default the Python script used. */
  path: string;
  apiBase: string;
  token: string;
  postIntervalMs?: number;
}

export interface ProbeBridge {
  stop(): void;
}

/**
 * Auto-starts with the app and just keeps retrying quietly if the meter
 * isn't plugged in yet or gets unplugged — this is the one advantage of
 * folding it into the app itself over the old separate script: there's no
 * "did I remember to start the bridge" step left to forget. It only ever
 * runs while the app itself is open, same lifecycle as everything else
 * here, so this isn't the "always-on background service" the original
 * script's own comments deliberately avoided being — it's scoped to the
 * app's own process, same as the Next server it's feeding.
 */
export function startProbeBridge(options: ProbeBridgeOptions): ProbeBridge {
  const postIntervalMs = options.postIntervalMs ?? 5000;
  let buf: Buffer<ArrayBufferLike> = Buffer.alloc(0);
  let lastPost = 0;
  let port: SerialPort | null = null;
  let stopped = false;
  let reconnectTimer: NodeJS.Timeout | null = null;

  function postReading(tempF: number) {
    fetch(`${options.apiBase}/api/probe/temperature`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${options.token}` },
      body: JSON.stringify({ tempFahrenheit: tempF, probeType: "bean" }),
    })
      .then(async (res) => {
        if (res.status === 404) {
          console.log(`[probe] ${tempF.toFixed(1)}°F (no active roast session — start one to begin logging)`);
        } else if (!res.ok) {
          console.log(`[probe] ${tempF.toFixed(1)}°F but ingest failed: ${res.status}`);
        } else {
          console.log(`[probe] ${tempF.toFixed(1)}°F logged`);
        }
      })
      .catch((err) => console.log(`[probe] ${tempF.toFixed(1)}°F but couldn't reach the server: ${err.message}`));
  }

  function scheduleReconnect() {
    if (stopped) return;
    reconnectTimer = setTimeout(connect, RECONNECT_DELAY_MS);
  }

  function connect() {
    if (stopped) return;
    buf = Buffer.alloc(0);
    port = new SerialPort({ path: options.path, baudRate: BAUD, autoOpen: false });
    port.open((err) => {
      if (err) {
        console.log(`[probe] couldn't open ${options.path} (${err.message}); retrying in ${RECONNECT_DELAY_MS / 1000}s`);
        scheduleReconnect();
      }
    });

    port.on("data", (chunk: Buffer) => {
      buf = Buffer.concat([buf, chunk]);
      for (;;) {
        const { frame, rest } = findFrame(buf);
        buf = rest;
        if (!frame) break;
        const tempF = parseTempF(frame);
        const now = Date.now();
        if (now - lastPost >= postIntervalMs) {
          lastPost = now;
          postReading(tempF);
        }
      }
      if (buf.length > FRAME_LEN * 4) {
        // Never found a valid frame in a while — resync, same as the Python version.
        buf = buf.subarray(-FRAME_LEN);
      }
    });

    port.on("error", (err) => {
      console.log(`[probe] serial error (${err.message}); retrying in ${RECONNECT_DELAY_MS / 1000}s`);
      port?.close(() => scheduleReconnect());
    });
  }

  connect();

  return {
    stop() {
      stopped = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      port?.close();
    },
  };
}
