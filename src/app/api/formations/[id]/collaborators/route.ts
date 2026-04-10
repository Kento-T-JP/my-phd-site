import prisma from "@/lib/db";
import { getAccessibleFormation, getFormationActor, mapFormationForClient } from "@/lib/formationAccess";
import { publishFormationEvent } from "@/lib/formationRealtime";

export const dynamic = "force-dynamic";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getFormationActor();
  const { id } = await params;
  const formationId = Number(id);
  if (!actor) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (Number.isNaN(formationId)) {
    return Response.json({ error: "Invalid id" }, { status: 400 });
  }

  const formation = await prisma.formation.findUnique({
    where: { id: formationId },
    select: { id: true, userId: true },
  });
  if (!formation) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  if (formation.userId !== actor.userId) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as { emails?: string[] };
  const normalizedEmails = Array.from(
    new Set(
      (body.emails ?? [])
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean)
    )
  ).filter((email) => email !== actor.email?.trim().toLowerCase());

  const users = normalizedEmails.length
    ? await prisma.user.findMany({
        where: {
          email: { in: normalizedEmails },
          status: "active",
        },
        select: { id: true, email: true },
      })
    : [];

  const foundEmails = new Set(users.map((user) => user.email.toLowerCase()));
  const missingEmails = normalizedEmails.filter((email) => !foundEmails.has(email));
  if (missingEmails.length > 0) {
    return Response.json(
      { error: `存在しない、または有効化されていないユーザーがあります: ${missingEmails.join(", ")}` },
      { status: 400 }
    );
  }

  await prisma.$transaction([
    prisma.formationCollaborator.deleteMany({ where: { formationId } }),
    ...(users.length > 0
      ? [
          prisma.formationCollaborator.createMany({
            data: users.map((user) => ({
              formationId,
              userId: user.id,
            })),
          }),
        ]
      : []),
  ]);

  const accessible = await getAccessibleFormation(formationId, actor.userId);
  const mapped = mapFormationForClient(accessible, actor.userId);
  publishFormationEvent(formationId, {
    type: "formation-updated",
    formationId,
    formation: mapped,
    actorUserId: actor.userId,
    occurredAt: new Date().toISOString(),
  });
  return Response.json(mapped);
}
