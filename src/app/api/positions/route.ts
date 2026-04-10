import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import { resolveSessionUserId } from "@/lib/sessionUser";
import { cacheTag } from "@/lib/cacheTags";
import { revalidateTagSafe, runWithCache } from "@/lib/cacheRuntime";
import { getDefaultPositions } from "@/lib/defaultPositions";
import { getFormationScopeOwnerId } from "@/lib/formationAccess";

function normalizePositionName(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ");
}

function positionKey(value: string): string {
  return normalizePositionName(value).toLowerCase();
}

const defaultPositionKeys = new Set(
  getDefaultPositions().map((name) => positionKey(name)),
);

export async function GET(req: Request) {
  const session = (await getServerSession(authOptions)) as {
    user?: { id?: string; email?: string; isAdmin?: boolean; status?: string };
    loginStage?: string;
    gatePassed?: boolean;
  } | null;
  const { userId } = await resolveSessionUserId(session);
  if (!Number.isFinite(userId)) {
    return NextResponse.json([]);
  }
  const { searchParams } = new URL(req.url);
  const formationId = Number(searchParams.get("formationId") ?? "");
  let ownerId = userId as number;
  if (Number.isFinite(formationId) && formationId > 0) {
    const scopedOwnerId = await getFormationScopeOwnerId(formationId, ownerId);
    ownerId = scopedOwnerId ?? ownerId;
  }
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

  const target = await prisma.userPosition.findFirst({
    where: { id: positionId, userId: ownerId },
    select: { id: true, name: true },
  });
  if (!target) {
    return NextResponse.json({ error: "Position not found" }, { status: 404 });
  }

  const removedKey = positionKey(target.name);
  const normalizePositionList = (list: string[]) =>
    list.filter((name) => positionKey(name) !== removedKey);

  await prisma.$transaction(async (tx) => {
    await tx.userPosition.deleteMany({
      where: { id: target.id, userId: ownerId },
    });

    const players = await tx.player.findMany({
      where: { userId: ownerId },
      select: { id: true, position: true },
    });
    const playerUpdates = players
      .map((item) => ({
        id: item.id,
        next: normalizePositionList(item.position),
        prevLength: item.position.length,
      }))
      .filter((item) => item.next.length !== item.prevLength)
      .map((item) =>
        tx.player.update({
          where: { id: item.id },
          data: { position: item.next },
        }),
      );

    const rosterPlayers = await tx.rosterPlayer.findMany({
      where: { roster: { userId: ownerId } },
      select: { rosterId: true, playerId: true, position: true },
    });
    const rosterPlayerUpdates = rosterPlayers
      .map((item) => ({
        rosterId: item.rosterId,
        playerId: item.playerId,
        next: normalizePositionList(item.position),
        prevLength: item.position.length,
      }))
      .filter((item) => item.next.length !== item.prevLength)
      .map((item) =>
        tx.rosterPlayer.update({
          where: {
            rosterId_playerId: {
              rosterId: item.rosterId,
              playerId: item.playerId,
            },
          },
          data: { position: item.next },
        }),
      );

    if (playerUpdates.length > 0) {
      await Promise.all(playerUpdates);
    }
    if (rosterPlayerUpdates.length > 0) {
      await Promise.all(rosterPlayerUpdates);
    }
  });

  revalidateTagSafe(cacheTag.positions(ownerId));
  return NextResponse.json({ ok: true, positionId: target.id });
}
