<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

## Temperature probe

Bean-temp readings reach the app via `POST /api/probe/temperature`
(`src/app/api/probe/temperature/route.ts`) — bearer-token authed against a
`ProbeToken` (`src/lib/probe-tokens.ts`), a machine credential minted per
*team* from `/admin`, not a user session; see that route's own comments
for why it's excluded from `proxy.ts`'s session gate. It always logs
against whichever `RoastSession` has `endedAt: null` **for that token's
own team** — a team only ever has one roast in flight at a time, so "the
active one" is unambiguous within a team, and the probe script never
needs to know a roast started or changed. (This used to be a single flat
`PROBE_INGEST_TOKEN` env var shared by every team, with the endpoint just
picking whichever team's session was most recently created — harmless
with one team, silently wrong the moment two teams roast at once; fixed
when per-team tokens replaced it.) A reading can land before `startedAt`
is set (roast still in setup); `atSeconds` is just `null` then.
`LiveProbePanel` shows "Connected" purely from reading recency — no
manual toggle — and a completed roast's curve chart prefers
`TemperatureReading` rows over hand-logged `TEMP` events once there are
at least two of them.

**Three ways to get bytes off the probe, all supported.** A cloud-hosted
Vercel deployment has no path to a USB device sitting on someone's laptop
— that's not an architecture choice, a serverless function simply can't
see local hardware, full stop. So there are three ways to actually get
bytes off the probe to the (hosted) app:

1. **The local bridge script** (`scripts/probe_bridge.py`, below) — a
   small always-local script that forwards over HTTP. More robust for
   something running unattended next to a hot roaster (survives losing
   focus, keeps running if you close the tab), and lets the probe's host
   machine be different from whatever device you're viewing the live
   roast on (e.g. probe on an old laptop by the roaster, live page open on
   your phone across the room). This two-process shape — tiny local agent
   feeding a cloud app — is the standard pattern anywhere a web app needs
   to touch local hardware (same idea as e.g. Datadog's agent or Home
   Assistant's local integrations).
2. **In-browser, via the Web Serial API**
   (`src/components/roasts/WebSerialProbeConnector.tsx`) — no local
   install needed, for the case where you can only use whatever computer
   is sitting at a co-roastery. Chromium-only (breaks in Safari/Firefox),
   and the reading stops if that exact tab is closed or navigated away
   (backgrounded/unfocused is fine), so it's deliberately not a
   replacement for the bridge script — just a lower-friction option for
   when the bridge script's setup isn't worth it. Ingests through
   `src/lib/probe-actions.ts`'s `logProbeReading` Server Action (a real
   signed-in, team-scoped call), not the bearer-token route below.
3. **In-browser, via Modbus RTU**
   (`src/components/roasts/ModbusProbeConnector.tsx`) — for an SF-6-class
   roaster's own built-in controller, instead of clipping on a separate
   meter at all. Same Web Serial primitives as option 2 above, gated to
   only render for a roaster whose probe catalog declares more than just
   `bean` (see `RoasterDefinition`/`src/lib/roasters.ts`). Ships two
   register-map presets (`src/lib/sfControllerPresets.ts`) since it's
   unknown which controller a given SF-6 actually has until someone's in
   front of it. **Unlike the Mastech protocol above, these register maps
   have no independent cross-check and no real hardware tested against
   them yet** — they're transcribed only from Artisan's own open-source
   device profiles (`artisan-roaster-scope/artisan`,
   `src/includes/Machines/San Franciscan/SF.aset` and `SF_Eurotherm.aset`),
   corroborated by a Cropster support doc describing the Eurotherm variant's
   physical connection, but not verified against a real unit. Treat the
   exact baud rate/register addresses/encodings as a starting point to
   confirm on-site, not a settled fact.

**The bridge script**: `scripts/probe_bridge.py`. Run manually before a
roast (deliberately not an always-on background service — start manual,
only automate if that becomes annoying):

```bash
cd apps/roasting
python3 -m pip install -r scripts/requirements.txt   # once
export PROBE_INGEST_TOKEN=...   # minted for your team from /admin
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

<!-- END:nextjs-agent-rules -->
