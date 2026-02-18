import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { FormationSharePayloadSchema } from "@/lib/schemas/formationShare";
import { unwrapParams } from "@/lib/unwrap";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await unwrapParams(params);
  if (!token) {
    return NextResponse.json({ error: "Invalid token" }, { status: 400 });
  }

  const share = await prisma.formationShare.findUnique({
    where: { token },
    select: {
      token: true,
      expiresAt: true,
      createdAt: true,
      payload: true,
      user: { select: { id: true, name: true, email: true } },
    },
  });
  if (!share) {
    return NextResponse.json({ error: "Share not found" }, { status: 404 });
  }
  if (share.expiresAt < new Date()) {
    return NextResponse.json({ error: "Share expired" }, { status: 410 });
  }

  const payloadParsed = FormationSharePayloadSchema.safeParse(share.payload);
  if (!payloadParsed.success) {
    return NextResponse.json({ error: "Invalid share payload" }, { status: 500 });
  }

  return NextResponse.json({
    token: share.token,
    expiresAt: share.expiresAt,
    createdAt: share.createdAt,
    author: {
      id: share.user.id,
      name: share.user.name,
      email: share.user.email,
    },
    formation: payloadParsed.data,
  });
}
