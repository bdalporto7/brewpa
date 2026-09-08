"use client";

import { useEffect, useRef, useState } from "react";
import { Usb, Loader2 } from "lucide-react";
import { SF_CONTROLLER_PRESETS, type SfControllerPreset } from "@/lib/sfControllerPresets";
import { buildReadInputRegistersRequest, parseModbusResponse, decodeFloat32BE, decodeUInt16BE } from "@/lib/modbusRtu";
import { logProbeReading } from "@/lib/probe-actions";
import { useToast } from "@/components/ui/ToastProvider";

const POLL_INTERVAL_MS = 5000;
const REQUEST_TIMEOUT_MS = 1000;
const PRESET_STORAGE_KEY = "sfProbePresetId";

type Status = "idle" | "connecting" | "connected";

interface Stats {
  requestsSent: number;
  responsesOk: number;
  crcFailures: number;
  timeouts: number;
  posts: number;
  lastBean: number | null;
  lastEnvironment: number | null;
  lastError: string | null;
}

const EMPTY_STATS: Stats = {
  requestsSent: 0,
  responsesOk: 0,
  crcFailures: 0,
  timeouts: 0,
  posts: 0,
  lastBean: null,
  lastEnvironment: null,
  lastError: null,
};

function readStoredPresetId(): string {
  try {
    const stored = localStorage.getItem(PRESET_STORAGE_KEY);
    if (stored && SF_CONTROLLER_PRESETS.some((p) => p.id === stored)) return stored;
  } catch {
    // Private browsing or storage disabled — fall through to the default.
  }
  return SF_CONTROLLER_PRESETS[0].id;
}

/**
 * A second Modbus RTU alternative to WebSerialProbeConnector's free-running
 * Mastech meter, for reading an SF-6's own built-in controller directly —
 * see src/lib/sfControllerPresets.ts for why the register maps are shipped
 * as two presets (SF factory Modbus vs. an EPC3008 Eurotherm retrofit):
 * nobody knows which one a given machine has until it's in front of them.
 *
 * Structurally different from the Mastech connector in one real way:
 * Modbus is request/response, not free-running, so this actively writes a
 * query every poll interval and waits for an answer with a timeout, rather
 * than just reading whatever the device is already broadcasting. That's
 * also why this needs port.writable (the Mastech connector never writes),
 * and why the preset has to be chosen *before* connecting — the baud rate
 * has to match on the first `open()` call, there's no free-running stream
 * to resync against if it's wrong.
 *
 * The chosen preset id is persisted to localStorage: the mount-time
 * getPorts() auto-reconnect (same pattern as the Mastech connector) needs
 * to know which baud rate to reopen at, and Web Serial's permission grant
 * itself doesn't remember what a port was last opened with.
 *
 * Stats are split by Modbus's actual failure modes, not just bytes/frames,
 * because they triage to different causes: zero responses ever means wrong
 * port/baud/wiring; responses that fail CRC or come back as a Modbus
 * exception mean a register/slave-id/encoding assumption is wrong for this
 * specific unit (a real risk — these presets are transcribed from Artisan's
 * community device profiles, not independently verified against real
 * hardware); a successful decode that fails to post is server-side, same
 * as the Mastech connector's own third bucket.
 */
export default function ModbusProbeConnector() {
  // Same hydration-safety reasoning as WebSerialProbeConnector's own
  // `supported` state: default to the deterministic SSR value, correct it
  // from a one-time mount effect.
  const [supported, setSupported] = useState(false);
  const [presetId, setPresetId] = useState(SF_CONTROLLER_PRESETS[0].id);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats>(EMPTY_STATS);
  const toast = useToast();

  const stoppedRef = useRef(false);
  const portRef = useRef<SerialPort | null>(null);
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);
  const writerRef = useRef<WritableStreamDefaultWriter<Uint8Array> | null>(null);

  useEffect(() => {
    setSupported(typeof navigator !== "undefined" && !!navigator.serial);
  }, []);

  async function readWithTimeout(
    reader: ReadableStreamDefaultReader<Uint8Array>,
    minLength: number,
    timeoutMs: number
  ): Promise<Uint8Array | null> {
    let buffer = new Uint8Array(0);
    const deadline = Date.now() + timeoutMs;

    while (buffer.length < minLength) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) return null;

      const outcome = await Promise.race([
        reader.read(),
        new Promise<"timeout">((resolve) => setTimeout(() => resolve("timeout"), remaining)),
      ]);
      if (outcome === "timeout") return null;

      const { value, done } = outcome;
      if (done || !value) return null;

      const combined = new Uint8Array(buffer.length + value.length);
      combined.set(buffer);
      combined.set(value, buffer.length);
      buffer = combined;
    }
    return buffer;
  }

  async function pollOnce(preset: SfControllerPreset) {
    const writer = writerRef.current;
    const reader = readerRef.current;
    if (!writer || !reader) return;

    for (const channel of preset.channels) {
      if (stoppedRef.current) return;

      const registerCount = channel.encoding === "float32" ? 2 : 1;
      const expectedByteCount = channel.encoding === "float32" ? 4 : 2;
      const request = buildReadInputRegistersRequest(preset.slaveId, channel.register, registerCount);

      setStats((s) => ({ ...s, requestsSent: s.requestsSent + 1 }));

      try {
        await writer.write(request);
        const response = await readWithTimeout(reader, 3 + expectedByteCount + 2, REQUEST_TIMEOUT_MS);
        if (!response) {
          setStats((s) => ({ ...s, timeouts: s.timeouts + 1, lastError: `No response for ${channel.label}.` }));
          continue;
        }

        const parsed = parseModbusResponse(response, { slaveId: preset.slaveId, expectedByteCount });
        if (!parsed.ok || !parsed.data) {
          setStats((s) => ({ ...s, crcFailures: s.crcFailures + 1, lastError: parsed.error ?? "Bad response." }));
          continue;
        }

        const value =
          channel.encoding === "float32"
            ? decodeFloat32BE(parsed.data)
            : decodeUInt16BE(parsed.data) / (channel.divisor ?? 1);

        setStats((s) => ({
          ...s,
          responsesOk: s.responsesOk + 1,
          lastBean: channel.key === "bean" ? value : s.lastBean,
          lastEnvironment: channel.key === "environment" ? value : s.lastEnvironment,
        }));

        const result = await logProbeReading(value, channel.key);
        if (result.ok) {
          setStats((s) => ({ ...s, posts: s.posts + 1, lastError: null }));
        } else {
          setStats((s) => ({ ...s, lastError: result.error }));
          toast(result.error, "error");
        }
      } catch (e) {
        setStats((s) => ({ ...s, lastError: e instanceof Error ? e.message : "Modbus request failed." }));
      }
    }
  }

  async function pollLoop(preset: SfControllerPreset) {
    while (!stoppedRef.current) {
      await pollOnce(preset);
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }
  }

  async function connectToPort(port: SerialPort, preset: SfControllerPreset) {
    await port.open({ baudRate: preset.baudRate });
    if (!port.readable || !port.writable) {
      setError("Port opened but has no readable/writable stream.");
      setStatus("idle");
      return;
    }
    portRef.current = port;
    readerRef.current = port.readable.getReader();
    writerRef.current = port.writable.getWriter();
    stoppedRef.current = false;
    setStats(EMPTY_STATS);
    setStatus("connected");
    pollLoop(preset);
  }

  // Reconnect to a previously-granted port with no click, same as
  // WebSerialProbeConnector — getPorts() needs no user gesture, only
  // requestPort() does.
  useEffect(() => {
    if (!supported) return;
    const storedPresetId = readStoredPresetId();
    setPresetId(storedPresetId);

    navigator.serial!.getPorts().then((ports) => {
      if (stoppedRef.current || ports.length === 0) return;
      const preset = SF_CONTROLLER_PRESETS.find((p) => p.id === storedPresetId) ?? SF_CONTROLLER_PRESETS[0];
      connectToPort(ports[0], preset).catch(() => {});
    });

    return () => {
      stoppedRef.current = true;
      readerRef.current?.cancel().catch(() => {});
      writerRef.current?.close().catch(() => {});
      portRef.current?.close().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supported]);

  function handlePresetChange(id: string) {
    setPresetId(id);
    try {
      localStorage.setItem(PRESET_STORAGE_KEY, id);
    } catch {
      // Private browsing or storage disabled — the selection still works this session.
    }
  }

  async function handleConnect() {
    setError(null);
    setStatus("connecting");
    try {
      // requestPort() first, nothing awaited before it — same gesture-
      // tracking constraint as WebSerialProbeConnector.
      const port = await navigator.serial!.requestPort();
      const preset = SF_CONTROLLER_PRESETS.find((p) => p.id === presetId) ?? SF_CONTROLLER_PRESETS[0];
      await connectToPort(port, preset);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Couldn't open the controller.";
      if (!message.toLowerCase().includes("no port selected")) {
        setError(message);
      }
      setStatus("idle");
    }
  }

  function handleDisconnect() {
    stoppedRef.current = true;
    readerRef.current?.cancel().catch(() => {});
    writerRef.current?.close().catch(() => {});
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
          <Usb className="h-3.5 w-3.5" /> SF controller connected · Disconnect
        </button>
        <p className="text-xs text-muted">
          {stats.requestsSent} sent · {stats.responsesOk} ok · {stats.crcFailures} bad · {stats.timeouts} timed out ·{" "}
          {stats.posts} logged
          {stats.lastBean != null && ` · bean ${stats.lastBean.toFixed(1)}°F`}
          {stats.lastEnvironment != null && ` · env ${stats.lastEnvironment.toFixed(1)}°F`}
        </p>
        {stats.lastError && <p className="text-xs text-danger">Last issue: {stats.lastError}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        <select
          value={presetId}
          onChange={(e) => handlePresetChange(e.target.value)}
          disabled={status === "connecting"}
          className="rounded-md border border-border bg-surface px-1.5 py-1 text-xs text-foreground disabled:opacity-50"
        >
          {SF_CONTROLLER_PRESETS.map((preset) => (
            <option key={preset.id} value={preset.id}>
              {preset.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={handleConnect}
          disabled={status === "connecting"}
          className="flex items-center gap-1.5 text-xs font-medium text-muted transition hover:text-foreground disabled:opacity-50"
        >
          {status === "connecting" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Usb className="h-3.5 w-3.5" />}
          {status === "connecting" ? "Connecting…" : "Connect SF controller"}
        </button>
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
