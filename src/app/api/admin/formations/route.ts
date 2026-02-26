import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";

export async function GET(req: Request) {
  const session = (await getServerSession(authOptions)) as { user?: { id?: string; email?: string; isAdmin?: boolean; status?: string }; loginStage?: string; gatePassed?: boolean } | null;
  const isAdmin = Boolean((session?.user as { isAdmin?: boolean } | undefined)?.isAdmin);
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const includeUsers = searchParams.get("includeUsers") === "1";
  const rawUserId = searchParams.get("userId");
  const query = searchParams.get("q")?.trim() ?? "";
  const userId = rawUserId ? Number(rawUserId) : NaN;
  if (rawUserId && Number.isNaN(userId)) {
    return NextResponse.json({ error: "Invalid userId" }, { status: 400 });
  }

  const formations = await prisma.formation.findMany({
    where: {
      ...(Number.isNaN(userId) ? {} : { userId }),
      ...(query
        ? {
            OR: [
              { name: { contains: query, mode: "insensitive" } },
              { user: { email: { contains: query, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    include: { user: { select: { email: true } } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });

  const mappedFormations = formations.map((f) => ({
    id: f.id,
    name: f.name,
    createdAt: f.createdAt,
    userId: f.userId,
    userEmail: f.user.email,
  }));

  if (!includeUsers) {
    return NextResponse.json(mappedFormations);
  }

  const grouped = await prisma.formation.groupBy({
    by: ["userId"],
    _count: { _all: true },
  });
  const ownerIds = grouped.map((g) => g.userId);
  const owners = ownerIds.length
    ? await prisma.user.findMany({
        where: { id: { in: ownerIds } },
        select: { id: true, email: true },
      })
    : [];
  const ownerById = new Map(owners.map((o) => [o.id, o.email]));
  const users = grouped
    .map((g) => ({
      id: g.userId,
      email: ownerById.get(g.userId) ?? `user-${g.userId}`,
      formationCount: g._count._all,
    }))
    .sort((a, b) => {
      if (b.formationCount !== a.formationCount) return b.formationCount - a.formationCount;
      return a.email.localeCompare(b.email);
    });

  return NextResponse.json({
    formations: mappedFormations,
    users,
  });
}
