import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import { FormationUpdateSchema } from "@/lib/schemas/formations";
import { unwrapParams } from "@/lib/unwrap";

async function getUser() {
  const session = (await getServerSession(authOptions)) as { user?: { id?: string; email?: string; isAdmin?: boolean; status?: string }; loginStage?: string; gatePassed?: boolean } | null;
  if (!session?.user?.email) return null;
  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  return user;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await unwrapParams(params);
  const num = Number(id);
  if (Number.isNaN(num)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const formation = await prisma.formation.findUnique({
    where: { id: num },
    include: { nodes: true },
  });
  if (!formation || formation.userId !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(formation);
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await unwrapParams(params);
  const num = Number(id);
  if (Number.isNaN(num)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json();
  const parsed = FormationUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
  }
  const data = parsed.data;
  const formation = await prisma.formation.findUnique({ where: { id: num } });
  if (!formation || formation.userId !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const normalizedName = (data.name ?? formation.name).trim();
  const duplicate = await prisma.formation.findFirst({
    where: {
      userId: user.id,
      id: { not: num },
      name: { equals: normalizedName, mode: "insensitive" },
    },
    select: { id: true },
  });
  if (duplicate) {
    return NextResponse.json(
      { error: "同じ名前のフォーメーションは使用できません。別名にしてください。" },
      { status: 409 }
    );
  }
  const updated = await prisma.formation.update({
    where: { id: num },
    data: {
      name: normalizedName,
      positions: (data.positions ?? formation.positions) as Prisma.InputJsonValue,
    },
  });
  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await unwrapParams(params);
  const num = Number(id);
  if (Number.isNaN(num)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const formation = await prisma.formation.findUnique({ where: { id: num } });
  if (!formation || formation.userId !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await prisma.formation.delete({ where: { id: num } });
  return NextResponse.json({ success: true });
}
