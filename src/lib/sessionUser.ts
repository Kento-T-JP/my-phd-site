import prisma from "@/lib/db";

type SessionLike = {
  user?: {
    id?: string;
    email?: string | null;
    isAdmin?: boolean;
  };
} | null;

export async function resolveSessionUserId(session: SessionLike): Promise<{
  userId?: number;
  isAdmin: boolean;
}> {
  const isAdmin = Boolean(session?.user?.isAdmin);
  const rawId = session?.user?.id;
  const parsed = rawId ? Number(rawId) : NaN;
  if (Number.isFinite(parsed)) {
    return { userId: parsed, isAdmin };
  }

  const email = session?.user?.email?.trim().toLowerCase();
  if (!email) {
    return { userId: undefined, isAdmin };
  }
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, isAdmin: true },
  });
  if (!user) {
    return { userId: undefined, isAdmin };
  }
  return { userId: user.id, isAdmin: isAdmin || user.isAdmin };
}
