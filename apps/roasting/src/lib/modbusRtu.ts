/**
 * Modbus RTU protocol primitives for reading a San Franciscan SF-6's
 * built-in temperature controller over Web Serial — see
 * src/lib/sfControllerPresets.ts for the actual register maps and
 * src/components/roasts/ModbusProbeConnector.tsx for the connector that
 * uses this. Unlike the Mastech meter's free-running broadcast
 * (mastechFrameParser.ts), Modbus RTU is request/response: this module
 * only builds "Read Input Registers" (function code 4) requests and
 * parses their responses, since that's the only function code either
 * known SF controller preset needs.
 *
 * Pure functions over byte buffers, no Web Serial types involved, so this
 * can be exercised directly without a real device — see the verification
 * script referenced in the plan for hand-computed request/response byte
 * sequences.
 */

const FUNCTION_READ_INPUT_REGISTERS = 0x04;
const EXCEPTION_FLAG = 0x80;

/** Modbus RTU CRC16: poly 0xA001, init 0xFFFF, appended low byte first. */
export function crc16Modbus(bytes: Uint8Array): number {
  let crc = 0xffff;
  for (const b of bytes) {
    crc ^= b;
    for (let i = 0; i < 8; i++) {
      if (crc & 1) {
        crc = (crc >> 1) ^ 0xa001;
      } else {
        crc >>= 1;
      }
    }
  }
  return crc;
}

/**
 * Builds a Read Input Registers (function 4) request frame:
 * [slaveId, 0x04, registerHi, registerLo, countHi, countLo, crcLo, crcHi].
 */
export function buildReadInputRegistersRequest(
  slaveId: number,
  register: number,
  registerCount: number
): Uint8Array {
  const frame = new Uint8Array(6);
  frame[0] = slaveId;
  frame[1] = FUNCTION_READ_INPUT_REGISTERS;
  frame[2] = (register >> 8) & 0xff;
  frame[3] = register & 0xff;
  frame[4] = (registerCount >> 8) & 0xff;
  frame[5] = registerCount & 0xff;

  const crc = crc16Modbus(frame);
  const withCrc = new Uint8Array(8);
  withCrc.set(frame);
  withCrc[6] = crc & 0xff;
  withCrc[7] = (crc >> 8) & 0xff;
  return withCrc;
}

export interface ModbusParseResult {
  ok: boolean;
  data?: Uint8Array;
  error?: string;
}

/**
 * Validates and unwraps a Read Input Registers response: echoed slave id,
 * function code (including the 0x84 exception-response case, whose
 * single data byte is the Modbus exception code), byte-count field, and
 * CRC. Never throws — a malformed or absent response is a real, expected
 * possibility on-site (wrong port/baud/register), not a bug to crash on.
 */
export function parseModbusResponse(
  buf: Uint8Array,
  opts: { slaveId: number; expectedByteCount: number }
): ModbusParseResult {
  const minLen = 5; // slaveId + function + byteCount + 2 CRC bytes, plus at least nothing of data
  if (buf.length < minLen) {
    return { ok: false, error: `Response too short (${buf.length} bytes).` };
  }

  const crcReceived = buf[buf.length - 2] | (buf[buf.length - 1] << 8);
  const crcComputed = crc16Modbus(buf.subarray(0, buf.length - 2));
  if (crcReceived !== crcComputed) {
    return { ok: false, error: "CRC mismatch." };
  }

  if (buf[0] !== opts.slaveId) {
    return { ok: false, error: `Unexpected slave id ${buf[0]} (expected ${opts.slaveId}).` };
  }

  const functionCode = buf[1];
  if (functionCode === (FUNCTION_READ_INPUT_REGISTERS | EXCEPTION_FLAG)) {
    return { ok: false, error: `Modbus exception 0x${buf[2].toString(16)}.` };
  }
  if (functionCode !== FUNCTION_READ_INPUT_REGISTERS) {
    return { ok: false, error: `Unexpected function code 0x${functionCode.toString(16)}.` };
  }

  const byteCount = buf[2];
  if (byteCount !== opts.expectedByteCount) {
    return { ok: false, error: `Unexpected byte count ${byteCount} (expected ${opts.expectedByteCount}).` };
  }
  if (buf.length < 3 + byteCount + 2) {
    return { ok: false, error: "Response shorter than its own byte count." };
  }

  return { ok: true, data: buf.subarray(3, 3 + byteCount) };
}

/** IEEE-754 big-endian float32 across 4 data bytes (2 Modbus registers). */
export function decodeFloat32BE(data: Uint8Array): number {
  return new DataView(data.buffer, data.byteOffset, 4).getFloat32(0, false);
}

/** Plain big-endian uint16 across 2 data bytes (1 Modbus register). */
export function decodeUInt16BE(data: Uint8Array): number {
  return new DataView(data.buffer, data.byteOffset, 2).getUint16(0, false);
}
