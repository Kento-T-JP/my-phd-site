import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";

async function getUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;
  return prisma.user.findUnique({ where: { email: session.user.email } });
}

export async function GET() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const list = await prisma.formation.findMany({ where: { userId: user.id }, orderBy: { id: 'asc' } });
  return NextResponse.json(list);
}

export async function POST(req: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { name, positions } = await req.json();
  const saved = await prisma.formation.create({
    data: {
      name: name || "Untitled",
      positions,
      userId: user.id,
    },
  });
  return NextResponse.json(saved, { status: 201 });
}

