import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import { FormationCreateSchema } from "@/lib/schemas/formations";

export const dynamic = "force-dynamic";

const noStoreHeaders = { "Cache-Control": "no-store" };

async function getUser() {
  const session = (await getServerSession(authOptions)) as { user?: { id?: string; email?: string; isAdmin?: boolean; status?: string }; loginStage?: string; gatePassed?: boolean } | null;
  if (!session?.user?.email) return null;
  return prisma.user.findUnique({ where: { email: session.user.email } });
}

export async function GET() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: noStoreHeaders }
    );
  }
  const list = await prisma.formation.findMany({
    where: { userId: user.id },
    orderBy: { id: "asc" },
    include: { nodes: true },
  });
  return NextResponse.json(list, { headers: noStoreHeaders });
}

export async function POST(req: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json();
  const parsed = FormationCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
  }
  const { name, positions, nodes } = parsed.data;
  const normalizedName = (name || "Untitled").trim();
  const duplicate = await prisma.formation.findFirst({
    where: {
      userId: user.id,
      name: { equals: normalizedName, mode: "insensitive" },
    },
    select: { id: true },
  });
  if (duplicate) {
    return NextResponse.json(
      { error: "同じ名前のフォーメーションは保存できません。別名にしてください。" },
      { status: 409 }
    );
  }
  const saved = await prisma.formation.create({
    data: {
      name: normalizedName,
      positions,
      userId: user.id,
      nodes: nodes
        ? {
            create: nodes.map((n) => ({
              x: n.x,
              y: n.y,
              playerId: n.playerId,
            })),
          }
        : undefined,
    },
    include: { nodes: true },
  });
  return NextResponse.json(saved, { status: 201 });
}
