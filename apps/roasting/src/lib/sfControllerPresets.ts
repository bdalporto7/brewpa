/**
 * Register maps for the two known San Franciscan SF-6 built-in controller
 * variants, for src/components/roasts/ModbusProbeConnector.tsx. Deliberately
 * kept separate from src/lib/roasters.ts: those presets are the DB-backed
 * RoasterDefinition catalog (each new entry needs a migration to reach
 * existing teams), while a controller preset here is a client-side protocol
 * detail that applies to the *same* SF-6 RoasterDefinition regardless of
 * which physical controller happens to be installed on a given machine.
 *
 * Transcribed from Artisan's own open-source device profiles
 * (artisan-roaster-scope/artisan, src/includes/Machines/San Franciscan/
 * SF.aset and SF_Eurotherm.aset) — unlike the Mastech meter's protocol,
 * these have no independent second source and no real hardware to verify
 * against yet. Both machines are configured for Fahrenheit output
 * (mode=F in the source files), so no unit conversion is applied here.
 */

export interface ModbusChannel {
  /** Matches RoasterProbe.key / TemperatureReading.probeType. */
  key: string;
  label: string;
  register: number;
  encoding: "float32" | "int16";
  /** int16 only — raw register value is divided by this to get °F. */
  divisor?: number;
}

export interface SfControllerPreset {
  id: string;
  label: string;
  baudRate: number;
  slaveId: number;
  channels: ModbusChannel[];
}

export const SF_CONTROLLER_PRESETS: SfControllerPreset[] = [
  {
    id: "sf-watlow",
    label: "SF factory Modbus (2019+)",
    baudRate: 9600,
    slaveId: 1,
    channels: [
      { key: "bean", label: "Bean (BT)", register: 450, encoding: "float32" },
      { key: "environment", label: "Environment (ET)", register: 360, encoding: "float32" },
    ],
  },
  {
    id: "sf-eurotherm",
    label: "SF + Eurotherm EPC3008 (retrofit)",
    baudRate: 19200,
    slaveId: 1,
    channels: [
      { key: "bean", label: "Bean (BT)", register: 289, encoding: "int16", divisor: 10 },
      { key: "environment", label: "Environment (ET)", register: 290, encoding: "int16", divisor: 10 },
    ],
  },
];
