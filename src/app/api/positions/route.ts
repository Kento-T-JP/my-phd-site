import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import { resolveSessionUserId } from "@/lib/sessionUser";
import { cacheTag } from "@/lib/cacheTags";
import { revalidateTagSafe, runWithCache } from "@/lib/cacheRuntime";
import { getDefaultPositions } from "@/lib/defaultPositions";

function normalizePositionName(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ");
}

function positionKey(value: string): string {
  return normalizePositionName(value).toLowerCase();
}

const defaultPositionKeys = new Set(
  getDefaultPositions().map((name) => positionKey(name)),
);

export async function GET() {
  const session = (await getServerSession(authOptions)) as {
    user?: { id?: string; email?: string; isAdmin?: boolean; status?: string };
    loginStage?: string;
    gatePassed?: boolean;
  } | null;
  const { userId } = await resolveSessionUserId(session);
  if (!Number.isFinite(userId)) {
    return NextResponse.json([]);
  }
  const ownerId = userId as number;
  const list = await runWithCache(
    async () =>
      prisma.userPosition.findMany({
        where: { userId: ownerId },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
    ["api-positions", String(ownerId)],
    { revalidate: 60, tags: [cacheTag.positions(ownerId)] },
  );
  return NextResponse.json(list);
}

export async function POST(req: Request) {
  const session = (await getServerSession(authOptions)) as {
    user?: { id?: string; email?: string; isAdmin?: boolean; status?: string };
    loginStage?: string;
    gatePassed?: boolean;
  } | null;
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { userId, isAdmin } = await resolveSessionUserId(session);
  if (!isAdmin && !Number.isFinite(userId)) {
    return NextResponse.json(
      { error: "ユーザー識別子が無効です。再ログイン後にお試しください。" },
      { status: 401 },
    );
  }
  if (!Number.isFinite(userId)) {
    return NextResponse.json({ error: "Position owner could not be resolved." }, { status: 400 });
  }
  const ownerId = userId as number;

  const body = (await req.json().catch(() => ({}))) as { name?: string };
  if (typeof body.name !== "string") {
    return NextResponse.json({ error: "Invalid name" }, { status: 400 });
  }
  const name = normalizePositionName(body.name);
  if (!name) {
    return NextResponse.json({ error: "ポジション名を入力してください。" }, { status: 400 });
  }
  if (name.length > 40) {
    return NextResponse.json({ error: "ポジション名は40文字以内で入力してください。" }, { status: 400 });
  }

  const normalizedName = positionKey(name);
  if (defaultPositionKeys.has(normalizedName)) {
    return NextResponse.json(
      { error: "デフォルトポジションは既に利用可能です。" },
      { status: 409 },
    );
  }
  const existing = await prisma.userPosition.findUnique({
    where: { userId_normalizedName: { userId: ownerId, normalizedName } },
    select: { id: true, name: true },
  });
  if (existing) {
    return NextResponse.json({ error: "同じ名前のポジションは追加できません。" }, { status: 409 });
  }
  const created = await prisma.userPosition.create({
    data: { userId: ownerId, name, normalizedName },
    select: { id: true, name: true },
  });
  revalidateTagSafe(cacheTag.positions(ownerId));
  return NextResponse.json(created, { status: 201 });
}

export async function DELETE(req: Request) {
  const session = (await getServerSession(authOptions)) as {
    user?: { id?: string; email?: string; isAdmin?: boolean; status?: string };
    loginStage?: string;
    gatePassed?: boolean;
  } | null;
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { userId, isAdmin } = await resolveSessionUserId(session);
  if (!isAdmin && !Number.isFinite(userId)) {
    return NextResponse.json(
      { error: "ユーザー識別子が無効です。再ログイン後にお試しください。" },
      { status: 401 },
    );
  }
  if (!Number.isFinite(userId)) {
    return NextResponse.json({ error: "Position owner could not be resolved." }, { status: 400 });
  }
  const ownerId = userId as number;

  const body = (await req.json().catch(() => ({}))) as { positionId?: number };
  const positionId = Number(body.positionId);
  if (!Number.isFinite(positionId)) {
    return NextResponse.json({ error: "positionId is required" }, { status: 400 });
  }
  const deleted = await prisma.userPosition.deleteMany({
    where: { id: positionId, userId: ownerId },
  });
  if (deleted.count === 0) {
    return NextResponse.json({ error: "Position not found" }, { status: 404 });
  }
  revalidateTagSafe(cacheTag.positions(ownerId));
  return NextResponse.json({ ok: true, positionId });
}
