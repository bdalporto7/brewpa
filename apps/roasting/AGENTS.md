<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

## Temperature probe

Bean-temp readings reach the app via `POST /api/probe/temperature`
(`src/app/api/probe/temperature/route.ts`) — bearer-token authed
(`PROBE_INGEST_TOKEN`, a flat machine credential, not a user session; see
that route's own comments for why it's excluded from `proxy.ts`'s session
gate). It always logs against whichever `RoastSession` has `endedAt: null`
— this app only ever has one roast in flight, so "the active one" is
unambiguous and the probe script never needs to know a roast started or
changed. A reading can land before `startedAt` is set (roast still in
setup); `atSeconds` is just `null` then. `LiveProbePanel` shows "Connected"
purely from reading recency — no manual toggle — and a completed roast's
curve chart prefers `TemperatureReading` rows over hand-logged `TEMP`
events once there are at least two of them.

**Why a local bridge script, not the Web Serial API.** A cloud-hosted
Vercel deployment has no path to a USB device sitting on someone's laptop
— that's not an architecture choice, a serverless function simply can't
see local hardware, full stop. Given that, there are two ways to actually
get bytes off the probe to the (hosted) app: a small always-local script
that forwards over HTTP (what's implemented), or the browser's Web Serial
API reading the port directly from the page. Web Serial was considered and
rejected: it's Chromium-only (breaks in Safari/Firefox), and reading stops
if that tab isn't open and foregrounded — a plain background script is
more robust for something running unattended next to a hot roaster, and
it lets the probe's host machine be different from whatever device you're
actually viewing the live roast on (e.g. probe on an old laptop by the
roaster, live page open on your phone across the room). This two-process
shape — tiny local agent feeding a cloud app — is the standard pattern
anywhere a web app needs to touch local hardware (same idea as e.g.
Datadog's agent or Home Assistant's local integrations), not a workaround
to clean up later.

**The bridge script**: `scripts/probe_bridge.py`. Run manually before a
roast (deliberately not an always-on background service — start manual,
only automate if that becomes annoying):

```bash
cd apps/roasting
python3 -m pip install -r scripts/requirements.txt   # once
export PROBE_INGEST_TOKEN=...   # from .env — same token the endpoint checks
python3 scripts/probe_bridge.py
```

Reads a **Mastech MS6514** dual-channel thermocouple meter over its USB
serial cable (a Silicon Labs CP2102 USB-to-UART bridge; the meter enumerates
as a plain serial port, e.g. `/dev/cu.usbserial-0001` on macOS — no
driver install needed, macOS already has the CP210x driver in-box) and
posts the connected channel's reading to the ingest endpoint every 5s.

*Protocol*, reverse-engineered by sniffing the raw byte stream (no public
datasheet from Mastech) and cross-checked against Artisan's open-source
`MS6514temperature()` parser (`artisanlib/comm.py` in
[artisan-roaster-scope/artisan](https://github.com/artisan-roaster-scope/artisan))
once found — that confirmed the byte offsets and caught that byte 12 is
the *other*, unplugged channel's not-connected flag, not the one actually
read:

- Free-runs at ~2Hz with no query needed — just open the port and read.
- 18-byte frames, header `0x65 0x14`, trailer `0x0d 0x0a` (CRLF); the
  script resyncs on the header if a read lands mid-frame.
- The connected channel's temperature is `(byte[5]*256 + byte[6]) / 10.0`
  °F — big-endian, tenths of a degree, no offset.
- Byte 12 (`0x40`) flags the *other* channel (bytes 7-8) as not connected
  — per Artisan's source, not something empirically guessed. Only the
  probed channel (bytes 5-6) is ever forwarded, unconditionally.

**Still open, now that there's real probe data to test against** (not
blocked on hardware anymore):
- `src/lib/tips.ts`'s live golden-roast comparison and "log a temp
  reading" nudge are still event-based only — doesn't know about probe
  readings, so it can show a stale nudge even with a probe actively
  connected.
- The static "Publish to GitHub Pages" export still renders curves from
  events only, not probe readings.

<!-- END:nextjs-agent-rules -->
