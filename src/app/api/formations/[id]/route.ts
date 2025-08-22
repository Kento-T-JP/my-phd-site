import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { FormationUpdateSchema } from "../route";
import { unwrapParams } from "@/lib/unwrap";

async function getUser() {
  const session = await getServerSession(authOptions);
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
  const updated = await prisma.formation.update({
    where: { id: num },
    data: {
      name: data.name ?? formation.name,
      positions: data.positions ?? formation.positions,
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
