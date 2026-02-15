import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";

export async function GET() {
  const session = (await getServerSession(authOptions)) as { user?: { id?: string; email?: string; isAdmin?: boolean; status?: string }; loginStage?: string; gatePassed?: boolean } | null;
  const isAdmin = Boolean((session?.user as { isAdmin?: boolean } | undefined)?.isAdmin);
  if (!isAdmin) {
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
