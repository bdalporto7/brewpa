"use client";

import { useEffect, useRef, useState } from "react";
import { Usb, Loader2 } from "lucide-react";
import { extractFrames } from "@/lib/mastechFrameParser";
import { logProbeReading } from "@/lib/probe-actions";
import { useToast } from "@/components/ui/ToastProvider";

// Matches the local bridge script's own default — the meter free-runs at
// ~2Hz, so this is close to the fastest the protocol can actually deliver
// (see scripts/probe_bridge.py's PROBE_POST_INTERVAL).
const POST_INTERVAL_MS = 1000;
const BAUD_RATE = 9600;

// A USB-serial adapter dropping for a moment (a cable wiggle, a power
// blip) used to kill logging for however long it took someone to notice
// "Probe connected" had silently flipped off and click reconnect — a real
// gap seen live, up to 80+ seconds, on an otherwise-uneventful roast. 5
// attempts spaced 2s apart rides out a transient drop without needing a
// click; a genuinely unplugged/dead device still gives up and asks for one
// rather than showing "Reconnecting…" forever.
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY_MS = 2000;

type Status = "idle" | "connecting" | "connected" | "reconnecting";

interface Stats {
  bytes: number;
  frames: number;
  posts: number;
  lastTemp: number | null;
  lastError: string | null;
}

const EMPTY_STATS: Stats = { bytes: 0, frames: 0, posts: 0, lastTemp: null, lastError: null };

/**
 * A second way to get a Mastech MS6514's readings into a live roast,
 * alongside the local bridge script (scripts/probe_bridge.py) — this one
 * runs entirely in the page via the Web Serial API, no local install
 * needed, for the case where you can only use whatever computer is sitting
 * at a co-roastery. Deliberately not a replacement: Web Serial is
 * Chromium-only and needs this exact tab to stay open (not necessarily
 * foregrounded, just not closed/navigated away), while the bridge script
 * survives losing focus and works from any browser on any other device.
 * Hidden entirely — not shown disabled — on a browser without
 * navigator.serial, rather than explaining a button that can never work.
 *
 * Device-agnostic by construction: requestPort() shows the browser's own
 * native "choose a device" picker over whatever's actually plugged in —
 * this never assumes a port path or hardcodes a device filter, since a
 * co-roastery's own machine has no reason to enumerate ports the same way
 * as any other.
 *
 * A previously-granted port (getPorts()) is reused automatically on
 * mount, with no click needed — confirmed live that requestPort() itself
 * needs to run with *nothing* awaited before it in the same call stack
 * ("Must be handling a user gesture" — Chromium invalidates the gesture
 * across even one intervening await), so the "reuse an existing grant"
 * check can't share a code path with the button's own requestPort() call
 * the way a first pass at this did; open() itself needs no gesture at
 * all, which is what makes reconnecting on mount possible in the first
 * place.
 *
 * The live byte/frame/post counters below aren't cosmetic — this is
 * hardware nobody but the person roasting can actually plug in, so when
 * something's wrong ("connected" but no readings ever show up on the
 * chart) there's no way to attach a debugger to find out where the
 * pipeline actually broke: no bytes at all points at the port/baud rate,
 * bytes but no frames points at the parser not matching this unit's real
 * output, frames but no successful posts points at the server side. A
 * silent catch block here would turn "which of three things broke" into
 * a guess.
 */
export default function WebSerialProbeConnector() {
  // Confirmed live: a lazy initializer here (`useState(() => typeof
  // navigator !== "undefined" && ...)`) hydration-mismatches — SSR always
  // evaluates with `navigator` undefined, so the server-rendered HTML has
  // this component returning null, while the client's first render (real
  // browser, `navigator.serial` exists) renders the actual button, and
  // React flags the mismatch. Defaulting to `false` and setting the real
  // value from an effect is the standard fix: SSR and the client's first
  // render both render null, then this one-time effect corrects it
  // immediately after mount — a normal post-hydration update, not a
  // mismatch, at the cost of the button appearing one tick after paint
  // instead of being present immediately.
  const [supported, setSupported] = useState(false);
  useEffect(() => {
    setSupported(typeof navigator !== "undefined" && !!navigator.serial);
  }, []);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats>(EMPTY_STATS);
  const toast = useToast();

  const stoppedRef = useRef(false);
  const portRef = useRef<SerialPort | null>(null);
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);
  // Latest parsed reading, updated as fast as frames arrive — posting reads
  // this on its own steady timer (below) rather than firing right when a
  // frame happens to land. Real hardware confirmed *not* to deliver bytes
  // at a steady pace through Web Serial (Chromium/OS-level USB-serial
  // buffering, not this app's parser or network path — verified live that
  // reads can go 30+ real seconds between deliveries while the port stays
  // "connected" the whole time), so tying posts directly to frame arrival
  // produced the exact same burstiness in what got logged. Posting the
  // latest known value on a fixed cadence instead means a burst of reads
  // catches the post cadence up to a slightly-stale temperature rather
  // than to a slightly-stale *and* irregular one.
  const latestTempRef = useRef<number | null>(null);
  const postTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const postInFlightRef = useRef(false);

  function ensurePostTimer() {
    if (postTimerRef.current) return;
    postTimerRef.current = setInterval(() => {
      if (stoppedRef.current || postInFlightRef.current || latestTempRef.current == null) return;
      postInFlightRef.current = true;
      const temp = latestTempRef.current;
      logProbeReading(temp, "bean")
        .then((result) => {
          if (result.ok) {
            setStats((s) => ({ ...s, posts: s.posts + 1, lastError: null }));
          } else {
            setStats((s) => ({ ...s, lastError: result.error }));
            toast(result.error, "error");
          }
        })
        .catch((e) => {
          // Surfaced, not swallowed — a post that keeps failing needs to be
          // visible, even though one failure isn't worth stopping the timer
          // for (the next tick a second later retries on its own).
          setStats((s) => ({ ...s, lastError: e instanceof Error ? e.message : "Couldn't reach the server." }));
        })
        .finally(() => {
          postInFlightRef.current = false;
        });
    }, POST_INTERVAL_MS);
  }

  function stopPostTimer() {
    if (postTimerRef.current) clearInterval(postTimerRef.current);
    postTimerRef.current = null;
  }

  async function readLoop(port: SerialPort) {
    let buffer = new Uint8Array(0);

    if (!port.readable) {
      setError("Port opened but has no readable stream.");
      setStatus("idle");
      return;
    }
    const reader = port.readable.getReader();
    readerRef.current = reader;
    ensurePostTimer();

    try {
      while (!stoppedRef.current) {
        const { value, done } = await reader.read();
        if (done) break;
        if (!value) continue;
        setStats((s) => ({ ...s, bytes: s.bytes + value.length }));

        const combined = new Uint8Array(buffer.length + value.length);
        combined.set(buffer);
        combined.set(value, buffer.length);
        const { frames, remainder } = extractFrames(combined);
        buffer = new Uint8Array(remainder);

        if (frames.length === 0) continue;
        latestTempRef.current = frames[frames.length - 1];
        setStats((s) => ({ ...s, frames: s.frames + frames.length, lastTemp: frames[frames.length - 1] }));
      }
    } catch (e) {
      readerRef.current = null;
      if (!stoppedRef.current) {
        void attemptAutoReconnect(port, e instanceof Error ? e.message : "Lost connection to the probe.");
      }
      return;
    }
    readerRef.current = null;
  }

  /**
   * Retries opening the same already-granted port after readLoop dies
   * unexpectedly (not a user-initiated Disconnect, which sets
   * stoppedRef first and is checked between every attempt). Deliberately
   * doesn't reset `stats` the way a fresh connect does — this is meant to
   * be invisible on success, a continuation of the same session rather
   * than a new one, so the running byte/frame/post counts should keep
   * counting through it.
   */
  async function attemptAutoReconnect(port: SerialPort, lastMessage: string) {
    setStatus("reconnecting");
    for (let attempt = 1; attempt <= MAX_RECONNECT_ATTEMPTS; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, RECONNECT_DELAY_MS));
      if (stoppedRef.current) return;

      try {
        await port.close().catch(() => {});
        await port.open({ baudRate: BAUD_RATE });
        setStatus("connected");
        setError(null);
        readLoop(port);
        return;
      } catch (e) {
        lastMessage = e instanceof Error ? e.message : lastMessage;
      }
    }

    if (stoppedRef.current) return;
    setError(`${lastMessage} (auto-reconnect gave up after ${MAX_RECONNECT_ATTEMPTS} tries — check the cable and reconnect.)`);
    setStatus("idle");
  }

  async function connectToPort(port: SerialPort) {
    await port.open({ baudRate: BAUD_RATE });
    portRef.current = port;
    stoppedRef.current = false;
    latestTempRef.current = null;
    setStats(EMPTY_STATS);
    setStatus("connected");
    readLoop(port);
  }

  // Reconnect to a previously-granted port with no click at all —
  // getPorts() lists only ports this origin already has permission for,
  // and open() itself needs no user gesture (only requestPort() does).
  useEffect(() => {
    if (supported) {
      navigator.serial!.getPorts().then((ports) => {
        if (!stoppedRef.current && ports.length > 0) connectToPort(ports[0]).catch(() => {});
      });
    }
    return () => {
      stoppedRef.current = true;
      stopPostTimer();
      readerRef.current?.cancel().catch(() => {});
      portRef.current?.close().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supported]);

  async function handleConnect() {
    setError(null);
    setStatus("connecting");
    try {
      // requestPort() first, nothing awaited before it — see this file's
      // header comment on why an intervening await (e.g. checking
      // getPorts() first) makes Chromium reject this with "Must be
      // handling a user gesture," even though it's still the same click.
      const port = await navigator.serial!.requestPort();
      await connectToPort(port);
    } catch (e) {
      // A cancelled picker dialog throws too — that's not a real error, just "never mind."
      const message = e instanceof Error ? e.message : "Couldn't open the probe.";
      if (!message.toLowerCase().includes("no port selected")) {
        setError(message);
      }
      setStatus("idle");
    }
  }

  function handleDisconnect() {
    stoppedRef.current = true;
    stopPostTimer();
    readerRef.current?.cancel().catch(() => {});
    // forget(), not just close() — this is an explicit "stop using this
    // device" click, not a pause. Without forget(), the permission grant
    // survives (getPorts() would still list it), and the mount-time
    // auto-reconnect above would just pick it right back up on the very
    // next page load, making Disconnect look like it silently didn't work.
    const port = portRef.current;
    port
      ?.close()
      .catch(() => {})
      .then(() => port.forget().catch(() => {}));
    portRef.current = null;
    setStatus("idle");
  }

  if (!supported) return null;

  if (status === "connected" || status === "reconnecting") {
    return (
      <div className="flex flex-col gap-1">
        <button
          type="button"
          onClick={handleDisconnect}
          className="flex items-center gap-1.5 text-xs font-medium text-accent transition hover:text-foreground"
        >
          {status === "reconnecting" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Usb className="h-3.5 w-3.5" />
          )}
          {status === "reconnecting" ? "Reconnecting…" : "Probe connected"} · Disconnect
        </button>
        <p className="text-xs text-muted">
          {stats.bytes}B received · {stats.frames} frames parsed
          {stats.lastTemp != null && ` (last ${stats.lastTemp.toFixed(1)}°F)`} · {stats.posts} logged
        </p>
        {stats.lastError && <p className="text-xs text-danger">Last post failed: {stats.lastError}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={handleConnect}
        disabled={status === "connecting"}
        className="flex items-center gap-1.5 text-xs font-medium text-muted transition hover:text-foreground disabled:opacity-50"
      >
        {status === "connecting" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Usb className="h-3.5 w-3.5" />}
        {status === "connecting" ? "Connecting…" : "Connect probe in this browser"}
      </button>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
