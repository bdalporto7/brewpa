import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/**
 * Polled by LiveProbePanel while a roast is pending or live — proxy.ts
 * already gates this path behind a signed-in session, but Server
 * Functions/route handlers are directly callable, so this re-checks
 * rather than trusting the proxy alone (same reasoning as
 * requireAdmin() in src/lib/admin-actions.ts).
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const readings = await prisma.temperatureReading.findMany({
    where: { roastSessionId: id },
    orderBy: { recordedAt: "asc" },
  });

  return NextResponse.json({ readings });
}
