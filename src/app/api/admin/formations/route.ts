import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const formations = await prisma.formation.findMany({
    include: { user: { select: { email: true } } },
    orderBy: { id: "asc" },
  });
  return NextResponse.json(
    formations.map((f) => ({
      id: f.id,
      name: f.name,
      createdAt: f.createdAt,
      userEmail: f.user.email,
    }))
  );
}
