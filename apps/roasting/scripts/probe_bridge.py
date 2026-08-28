#!/usr/bin/env python3
"""
Bridge between a Mastech MS6514 thermocouple meter (plugged in over its
USB/CP2102 serial cable) and this app's probe ingest endpoint
(POST /api/probe/temperature). Run this by hand once you start a roast;
it forwards whichever channel your bean probe is wired into every few
seconds for as long as it's running.

Protocol reverse-engineered against a real MS6514 by sniffing the raw
serial stream, then confirmed against Artisan's own open-source parser
(MS6514temperature() in artisanlib/comm.py) — the meter free-runs an
18-byte frame roughly twice a second with no query needed:

    byte 0-1    fixed header, 0x65 0x14
    byte 5-6    channel-A reading, big-endian, tenths of a degree
    byte 7-8    channel-B reading, same encoding
    byte 12     0x40 when channel B has nothing plugged into it
    byte 16-17  fixed trailer, 0x0d 0x0a (CRLF)

Only channel A (bytes 5-6) is forwarded — that's the one with an actual
probe wired to it during calibration. Byte 12 is channel B's NC flag (it
was 0x40, i.e. "not connected", in every single calibration capture,
which is what confirmed channel B is the open/unused one) — it says
nothing about channel A, so it's not checked here; channel A is always
read as-is.

Usage:
    python3 probe_bridge.py

Config (env vars, all optional except PROBE_INGEST_TOKEN):
    PROBE_SERIAL_PORT   default /dev/cu.usbserial-0001
    PROBE_API_BASE      default https://roasting-three.vercel.app
    PROBE_INGEST_TOKEN  required — same value as PROBE_INGEST_TOKEN in
                         the app's .env (or Vercel env for production)
    PROBE_POST_INTERVAL default 5 (seconds between forwarded readings —
                         the meter streams much faster than this app's
                         chart needs, so most frames are just discarded)
"""

import os
import sys
import time
import serial
import requests

SERIAL_PORT = os.environ.get("PROBE_SERIAL_PORT", "/dev/cu.usbserial-0001")
API_BASE = os.environ.get("PROBE_API_BASE", "https://roasting-three.vercel.app")
TOKEN = os.environ.get("PROBE_INGEST_TOKEN")
POST_INTERVAL = float(os.environ.get("PROBE_POST_INTERVAL", "5"))
BAUD = 9600
FRAME_LEN = 18


def find_frame(buf: bytes) -> tuple[bytes | None, bytes]:
    """Pulls one complete 18-byte frame out of buf if present, starting
    from the header bytes (0x65 0x14) rather than assuming buf is already
    aligned — the stream doesn't respect our read() boundaries, so a
    previous partial read can leave us mid-frame."""
    idx = buf.find(bytes([0x65, 0x14]))
    if idx == -1 or len(buf) < idx + FRAME_LEN:
        return None, buf
    frame = buf[idx : idx + FRAME_LEN]
    if frame[16] != 0x0D or frame[17] != 0x0A:
        # Header matched by coincidence mid-payload — drop up to just past
        # it and let the next find() try again further along.
        return None, buf[idx + 2 :]
    return frame, buf[idx + FRAME_LEN :]


def parse_temp_f(frame: bytes) -> float:
    return (frame[5] * 256 + frame[6]) / 10.0


def post_reading(temp_f: float) -> None:
    try:
        resp = requests.post(
            f"{API_BASE}/api/probe/temperature",
            json={"tempFahrenheit": temp_f, "probeType": "bean"},
            headers={"Authorization": f"Bearer {TOKEN}"},
            timeout=5,
        )
        if resp.status_code == 404:
            print(f"  -> {temp_f:.1f}°F (no active roast session — start one to begin logging)")
        elif not resp.ok:
            print(f"  -> {temp_f:.1f}°F but ingest failed: {resp.status_code} {resp.text[:200]}")
        else:
            print(f"  -> {temp_f:.1f}°F logged")
    except requests.RequestException as e:
        print(f"  -> {temp_f:.1f}°F but couldn't reach the server: {e}")


def main() -> None:
    if not TOKEN:
        print("PROBE_INGEST_TOKEN is not set. Export it (same value as the app's .env) and re-run.")
        sys.exit(1)

    print(f"Opening {SERIAL_PORT} at {BAUD} 8N1...")
    print(f"Posting to {API_BASE}/api/probe/temperature every {POST_INTERVAL:.0f}s. Ctrl+C to stop.")

    buf = b""
    last_post = 0.0

    while True:
        try:
            with serial.Serial(SERIAL_PORT, BAUD, timeout=1) as ser:
                buf = b""
                while True:
                    chunk = ser.read(64)
                    if chunk:
                        buf += chunk
                        while True:
                            frame, buf = find_frame(buf)
                            if frame is None:
                                break
                            temp_f = parse_temp_f(frame)
                            now = time.monotonic()
                            if now - last_post >= POST_INTERVAL:
                                last_post = now
                                post_reading(temp_f)
                    if len(buf) > FRAME_LEN * 4:
                        # Never found a valid frame in a while — resync by
                        # dropping everything before the last possible header.
                        buf = buf[-FRAME_LEN:]
        except serial.SerialException as e:
            print(f"Serial error ({e}); retrying in 3s — check the meter is plugged in.")
            time.sleep(3)
        except KeyboardInterrupt:
            print("\nStopped.")
            return


if __name__ == "__main__":
    main()
