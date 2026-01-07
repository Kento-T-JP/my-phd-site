import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/prisma";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as
    | { consent?: boolean }
    | null;
  if (!body || typeof body.consent !== "boolean") {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (session.user.id === "admin") {
    return NextResponse.json({ error: "Invalid user" }, { status: 400 });
  }

  const userId = Number(session.user.id);
  if (Number.isNaN(userId)) {
    return NextResponse.json({ error: "Invalid user" }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: userId },
    data: { googleEmailConsent: body.consent },
  });

  return NextResponse.json({ ok: true });
}
