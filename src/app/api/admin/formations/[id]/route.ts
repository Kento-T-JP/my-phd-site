import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import { unwrapParams } from "@/lib/unwrap";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = (await getServerSession(authOptions)) as { user?: { id?: string; email?: string; isAdmin?: boolean; status?: string }; loginStage?: string; gatePassed?: boolean } | null;
  const isAdmin = Boolean((session?.user as { isAdmin?: boolean } | undefined)?.isAdmin);
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await unwrapParams(params);
  const num = Number(id);
  if (Number.isNaN(num)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }
  const formation = await prisma.formation.findUnique({
    where: { id: num },
    include: { nodes: { orderBy: { id: "asc" } }, user: { select: { email: true } } },
  });
  if (!formation) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({
    id: formation.id,
    name: formation.name,
    createdAt: formation.createdAt,
    userEmail: formation.user.email,
    positions: formation.positions,
    nodes: formation.nodes,
  });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = (await getServerSession(authOptions)) as { user?: { id?: string; email?: string; isAdmin?: boolean; status?: string }; loginStage?: string; gatePassed?: boolean } | null;
  const isAdmin = Boolean((session?.user as { isAdmin?: boolean } | undefined)?.isAdmin);
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await unwrapParams(params);
  const num = Number(id);
  if (Number.isNaN(num)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }
  await prisma.formation.delete({ where: { id: num } });
  return NextResponse.json({ success: true });
}
