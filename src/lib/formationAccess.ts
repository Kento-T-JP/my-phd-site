import prisma from "@/lib/db";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import { resolveSessionUserId } from "@/lib/sessionUser";

const ACTIVE_EDITOR_WINDOW_MS = 30_000;

export type FormationActor = {
  userId: number;
  email?: string | null;
  isAdmin: boolean;
};

export async function getFormationActor(): Promise<FormationActor | null> {
  const session = (await getServerSession(authOptions)) as {
    user?: { id?: string; email?: string | null; isAdmin?: boolean };
  } | null;
  const resolved = await resolveSessionUserId(session);
  if (!resolved.userId) {
    return null;
  }
  return {
    userId: resolved.userId,
    email: session?.user?.email ?? null,
    isAdmin: resolved.isAdmin,
  };
}

export function getActiveEditorThreshold(): Date {
  return new Date(Date.now() - ACTIVE_EDITOR_WINDOW_MS);
}

export async function getAccessibleFormation(
  formationId: number,
  actorUserId: number
) {
  return prisma.formation.findFirst({
    where: {
      id: formationId,
      OR: [
        { userId: actorUserId },
        { collaborators: { some: { userId: actorUserId } } },
      ],
    },
    include: {
      nodes: { orderBy: { id: "asc" } },
      user: { select: { id: true, name: true, email: true } },
      collaborators: {
        orderBy: [{ user: { name: "asc" } }, { user: { email: "asc" } }],
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      },
      editSessions: {
        where: { lastSeenAt: { gte: getActiveEditorThreshold() } },
        orderBy: { lastSeenAt: "desc" },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      },
    },
  });
}

export async function getFormationScopeOwnerId(
  formationId: number,
  actorUserId: number
): Promise<number | null> {
  const formation = await prisma.formation.findFirst({
    where: {
      id: formationId,
      OR: [
        { userId: actorUserId },
        { collaborators: { some: { userId: actorUserId } } },
      ],
    },
    select: { userId: true },
  });
  return formation?.userId ?? null;
}

export function mapFormationForClient<T extends Awaited<ReturnType<typeof getAccessibleFormation>>>(
  formation: T,
  actorUserId: number
) {
  if (!formation) return null;
  return {
    ...formation,
    owner: formation.user,
    accessRole: formation.userId === actorUserId ? "owner" : "collaborator",
    collaborators: formation.collaborators.map((entry) => ({
      id: entry.user.id,
      name: entry.user.name,
      email: entry.user.email,
    })),
    activeEditors: formation.editSessions.map((entry) => ({
      id: entry.user.id,
      name: entry.user.name,
      email: entry.user.email,
      lastSeenAt: entry.lastSeenAt,
    })),
  };
}
