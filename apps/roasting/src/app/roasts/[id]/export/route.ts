import { NextResponse } from "next/server";
import { format } from "date-fns";
import { prisma } from "@/lib/prisma";
import { buildRoastCsv } from "@/lib/csv";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const session = await prisma.roastSession.findUnique({
    where: { id },
    include: { bean: true, events: { orderBy: { atSeconds: "asc" } } },
  });

  if (!session) {
    return NextResponse.json({ error: "Roast not found." }, { status: 404 });
  }
  if (!session.startedAt || !session.endedAt) {
    return NextResponse.json({ error: "This roast hasn't been completed yet." }, { status: 400 });
  }

  const csv = buildRoastCsv(session);
  const filename = `${session.bean.name}-${format(session.startedAt, "yyyy-MM-dd")}.csv`
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, "-");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
