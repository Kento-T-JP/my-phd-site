import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import React from "react";

async function unwrap(params: Promise<{ id: string }> | { id: string }) {
  if (
    (React as any).use &&
    (React as any).__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED?.ReactCurrentDispatcher
      .current
  ) {
    return React.use(params as any);
  }
  return params instanceof Promise ? await params : params;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await unwrap(params);
  const num = Number(id);
  if (Number.isNaN(num)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }
  const formation = await prisma.formation.findUnique({
    where: { id: num },
    include: { nodes: true, user: { select: { email: true } } },
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
  const session = await getServerSession(authOptions);
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await unwrap(params);
  const num = Number(id);
  if (Number.isNaN(num)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }
  await prisma.formation.delete({ where: { id: num } });
  return NextResponse.json({ success: true });
}
