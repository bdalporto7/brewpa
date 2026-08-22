import { format } from "date-fns";
import { formatMMSS } from "@/lib/format";
import { EVENT_LABELS, type EventType } from "@/lib/constants";
import type { Bean, RoastEvent, RoastSession } from "@prisma/client";

function cell(value: string | number | null | undefined): string {
  const raw = value == null ? "" : String(value);
  return /[",\n]/.test(raw) ? `"${raw.replace(/"/g, '""')}"` : raw;
}

function row(values: (string | number | null | undefined)[]): string {
  return values.map(cell).join(",") + "\r\n";
}

export function buildRoastCsv(
  session: RoastSession & { bean: Bean; events: RoastEvent[] }
): string {
  const weightLoss =
    session.roastedWeightGrams != null
      ? (1 - session.roastedWeightGrams / session.greenWeightGrams) * 100
      : null;

  let csv = "";
  csv += row(["Bean", session.bean.name]);
  csv += row(["Origin", session.bean.origin]);
  csv += row(["Process", session.bean.process]);
  csv += row(["Roast date", format(session.startedAt, "yyyy-MM-dd HH:mm")]);
  csv += row(["Green weight (g)", session.greenWeightGrams]);
  csv += row(["Roasted weight (g)", session.roastedWeightGrams]);
  csv += row(["Weight loss (%)", weightLoss != null ? weightLoss.toFixed(1) : ""]);
  csv += row(["Roast level", session.roastLevel]);
  csv += row(["Rating (of 5)", session.rating]);
  csv += row([
    "Duration",
    session.endedAt
      ? formatMMSS((session.endedAt.getTime() - session.startedAt.getTime()) / 1000)
      : "",
  ]);
  csv += row(["Notes", session.notes]);
  csv += "\r\n";

  csv += row(["Elapsed (mm:ss)", "Elapsed (sec)", "Event", "Fan level", "Heat level", "Temp (°F)", "Note"]);
  for (const event of session.events) {
    csv += row([
      formatMMSS(event.atSeconds),
      event.atSeconds,
      EVENT_LABELS[event.type as EventType] ?? event.type,
      event.fanLevel,
      event.heatLevel,
      event.tempFahrenheit,
      event.note,
    ]);
  }

  return csv;
}
