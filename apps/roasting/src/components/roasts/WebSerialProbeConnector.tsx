"use client";

import { useEffect, useRef, useState } from "react";
import { Usb, Loader2 } from "lucide-react";
import { extractFrames } from "@/lib/mastechFrameParser";
import { logProbeReading } from "@/lib/probe-actions";
import { useToast } from "@/components/ui/ToastProvider";

// Matches the local bridge script's own default — the meter free-runs
// much faster than the chart needs, so most frames are just discarded
// between posts (see scripts/probe_bridge.py's PROBE_POST_INTERVAL).
const POST_INTERVAL_MS = 5000;
const BAUD_RATE = 9600;

type Status = "idle" | "connecting" | "connected";

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
  // Static for the life of this mount — a browser doesn't gain/lose Web
  // Serial support mid-session — so this is a lazy initializer, not
  // something an effect needs to set (setting state directly inside an
  // effect body is exactly the cascading-render pattern React's own hooks
  // lint warns about; this has no such effect to begin with).
  const [supported] = useState(() => typeof navigator !== "undefined" && !!navigator.serial);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats>(EMPTY_STATS);
  const toast = useToast();

  const stoppedRef = useRef(false);
  const portRef = useRef<SerialPort | null>(null);
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);

  async function readLoop(port: SerialPort) {
    let buffer = new Uint8Array(0);
    let lastPost = 0;

    if (!port.readable) {
      setError("Port opened but has no readable stream.");
      setStatus("idle");
      return;
    }
    const reader = port.readable.getReader();
    readerRef.current = reader;

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
        setStats((s) => ({ ...s, frames: s.frames + frames.length, lastTemp: frames[frames.length - 1] }));

        const now = Date.now();
        if (now - lastPost < POST_INTERVAL_MS) continue;
        lastPost = now;

        const latestTemp = frames[frames.length - 1];
        try {
          const result = await logProbeReading(latestTemp, "bean");
          if (result.ok) {
            setStats((s) => ({ ...s, posts: s.posts + 1, lastError: null }));
          } else {
            setStats((s) => ({ ...s, lastError: result.error }));
            toast(result.error, "error");
          }
        } catch (e) {
          // Surfaced, not swallowed — a post that keeps failing needs to be
          // visible, even though one failure isn't worth interrupting the
          // read loop for (the next reading a few seconds later retries on its own).
          setStats((s) => ({ ...s, lastError: e instanceof Error ? e.message : "Couldn't reach the server." }));
        }
      }
    } catch (e) {
      if (!stoppedRef.current) {
        setError(e instanceof Error ? e.message : "Lost connection to the probe.");
        setStatus("idle");
      }
    } finally {
      readerRef.current = null;
    }
  }

  async function connectToPort(port: SerialPort) {
    await port.open({ baudRate: BAUD_RATE });
    portRef.current = port;
    stoppedRef.current = false;
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

  if (status === "connected") {
    return (
      <div className="flex flex-col gap-1">
        <button
          type="button"
          onClick={handleDisconnect}
          className="flex items-center gap-1.5 text-xs font-medium text-accent transition hover:text-foreground"
        >
          <Usb className="h-3.5 w-3.5" /> Probe connected · Disconnect
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
