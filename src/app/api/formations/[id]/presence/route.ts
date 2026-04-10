import prisma from "@/lib/db";
import { getAccessibleFormation, getFormationActor } from "@/lib/formationAccess";
import { publishFormationEvent } from "@/lib/formationRealtime";

export const dynamic = "force-dynamic";

function mapEditors(
  editors: Array<{
    user: { id: number; name: string | null; email: string };
    lastSeenAt: Date;
  }>
) {
  return editors.map((entry) => ({
    id: entry.user.id,
    name: entry.user.name,
    email: entry.user.email,
    lastSeenAt: entry.lastSeenAt,
  }));
}

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getFormationActor();
  const { id } = await params;
  const formationId = Number(id);
  if (!actor) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (Number.isNaN(formationId)) {
    return Response.json({ error: "Invalid id" }, { status: 400 });
  }

  const formation = await getAccessibleFormation(formationId, actor.userId);
  if (!formation) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.formationEditSession.upsert({
    where: {
      formationId_userId: {
        formationId,
        userId: actor.userId,
      },
    },
    update: { lastSeenAt: new Date() },
    create: {
      formationId,
      userId: actor.userId,
    },
  });

  const refreshed = await prisma.formationEditSession.findMany({
    where: {
      formationId,
      lastSeenAt: { gte: new Date(Date.now() - 30_000) },
    },
    orderBy: { lastSeenAt: "desc" },
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
  });

  const editors = mapEditors(refreshed);
  publishFormationEvent(formationId, {
    type: "presence",
    formationId,
    editors,
    occurredAt: new Date().toISOString(),
  });

  return Response.json({ editors });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getFormationActor();
  const { id } = await params;
  const formationId = Number(id);
  if (!actor) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (Number.isNaN(formationId)) {
    return Response.json({ error: "Invalid id" }, { status: 400 });
  }

  await prisma.formationEditSession.deleteMany({
    where: {
      formationId,
      userId: actor.userId,
    },
  });

  const refreshed = await prisma.formationEditSession.findMany({
    where: {
      formationId,
      lastSeenAt: { gte: new Date(Date.now() - 30_000) },
    },
    orderBy: { lastSeenAt: "desc" },
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
  });

  publishFormationEvent(formationId, {
    type: "presence",
    formationId,
    editors: mapEditors(refreshed),
    occurredAt: new Date().toISOString(),
  });

  return Response.json({ success: true });
}
