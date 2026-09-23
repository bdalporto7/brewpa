/**
 * Browser-side port of scripts/probe_bridge.py's frame parser, for reading
 * a Mastech MS6514 directly from a page via the Web Serial API instead of
 * through the local bridge script — see AGENTS.md's temperature-probe
 * section for the full reverse-engineered protocol writeup (cross-checked
 * against Artisan's own MS6514temperature() parser). Kept as a pure
 * function over a byte buffer, no Web Serial types involved, so it can be
 * exercised directly without a real device or a browser.
 *
 * The meter free-runs an 18-byte frame roughly twice a second with no
 * query needed: byte 0-1 header (0x65 0x14), bytes 5-6 the connected
 * channel's reading (big-endian, tenths of a degree F), byte 12 flags the
 * *other*, unplugged channel (not checked here — only the probed channel
 * is ever forwarded), bytes 16-17 trailer (0x0d 0x0a).
 */
const HEADER = [0x65, 0x14];
const TRAILER_OFFSET = 16;
const FRAME_LEN = 18;

export interface FrameResult {
  /** Parsed frames pulled out of the buffer, in stream order. */
  frames: number[];
  /** Whatever's left after the last complete frame — carry this into the next chunk. */
  remainder: Uint8Array;
}

/** °F, tenths-of-a-degree precision — same encoding as probe_bridge.py's parse_temp_f. */
function parseTempF(frame: Uint8Array): number {
  return (frame[5] * 256 + frame[6]) / 10;
}

/**
 * Pulls every complete frame out of `buf`, resyncing on the header bytes
 * rather than assuming the buffer starts aligned — a Web Serial read
 * chunk boundary has no relationship to the meter's own frame boundaries,
 * same reasoning as find_frame()'s docstring in probe_bridge.py.
 *
 * Found live (2026-09-22, via scripts/_test_frame_parser.mts feeding this
 * function realistic byte-at-a-time chunks): the previous version's header
 * search only ever looked for a *complete* 2-byte match, so whenever a
 * chunk boundary landed between a frame's two header bytes — the normal
 * case once Web Serial hands the read loop data in small dribbles, which
 * is exactly how this meter's slow ~36 bytes/sec trickles in — the lone
 * leading header byte at the end of the buffer got treated as "no header
 * found" and discarded outright along with everything before it, instead
 * of being kept as a pending partial match. That silently ate the frame:
 * this is the actual mechanism behind readings freezing for long stretches
 * while the byte counter kept climbing (the connection was fine, frames
 * just kept losing their header this way). Scanning one byte at a time and
 * explicitly keeping a trailing lone HEADER[0] as remainder fixes it.
 */
export function extractFrames(buf: Uint8Array): FrameResult {
  const temps: number[] = [];
  let pos = 0;

  while (pos < buf.length) {
    let idx = -1;
    for (let i = pos; i < buf.length; i++) {
      if (buf[i] === HEADER[0]) {
        idx = i;
        break;
      }
    }
    if (idx === -1) {
      pos = buf.length;
      break;
    }
    if (idx + 1 >= buf.length) {
      // Only the first header byte has arrived so far — keep it and wait
      // for the rest instead of discarding it as noise.
      pos = idx;
      break;
    }
    if (buf[idx + 1] !== HEADER[1]) {
      pos = idx + 1;
      continue;
    }
    if (buf.length < idx + FRAME_LEN) {
      // Full header confirmed, but the rest of the frame hasn't arrived yet.
      pos = idx;
      break;
    }
    const frame = buf.subarray(idx, idx + FRAME_LEN);
    if (frame[TRAILER_OFFSET] !== 0x0d || frame[TRAILER_OFFSET + 1] !== 0x0a) {
      // Header matched by coincidence mid-payload — resync one byte past it.
      pos = idx + 1;
      continue;
    }
    temps.push(parseTempF(frame));
    pos = idx + FRAME_LEN;
  }

  return { frames: temps, remainder: buf.subarray(pos) };
}
