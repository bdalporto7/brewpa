import { NextResponse } from "next/server";
import { format } from "date-fns";
import { prisma } from "@/lib/prisma";
import { buildRoastCsv } from "@/lib/csv";
import { getCurrentAllowedUser } from "@/lib/admin";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // proxy.ts's session gate already keeps out anyone signed out entirely,
  // but never checked that the caller's *team* actually owns this roast —
  // this route had no auth check of its own at all.
  const user = await getCurrentAllowedUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const session = await prisma.roastSession.findFirst({
    where: { id, teamId: user.teamId },
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
