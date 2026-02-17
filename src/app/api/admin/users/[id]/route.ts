import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/authOptions';
import { z } from 'zod';
import { unwrapParams } from '@/lib/unwrap';
import { cacheTag } from '@/lib/cacheTags';
import { revalidateTagSafe } from '@/lib/cacheRuntime';


const AdminUserUpdateSchema = z.object({
  isAdmin: z.boolean(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = (await getServerSession(authOptions)) as { user?: { id?: string; email?: string; isAdmin?: boolean; status?: string }; loginStage?: string; gatePassed?: boolean } | null;
  const isAdmin = Boolean((session?.user as { isAdmin?: boolean } | undefined)?.isAdmin);
  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const unwrapped = await unwrapParams(params);
  const id = Number(unwrapped.id);
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }
  const parsed = AdminUserUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }
  const user = await prisma.user.update({
    where: { id },
    data: { isAdmin: parsed.data.isAdmin },
    select: { id: true, email: true, emailVerified: true, isAdmin: true },
  });
  return NextResponse.json(user);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = (await getServerSession(authOptions)) as { user?: { id?: string; email?: string; isAdmin?: boolean; status?: string }; loginStage?: string; gatePassed?: boolean } | null;
  const isAdmin = Boolean((session?.user as { isAdmin?: boolean } | undefined)?.isAdmin);
  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const unwrapped = await unwrapParams(params);
  const id = Number(unwrapped.id);
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
  }
  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true },
  });
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  try {
    await prisma.$transaction(
      async (tx) => {
        await tx.favoritePlayer.deleteMany({
          where: {
            OR: [{ userId: id }, { player: { userId: id } }],
          },
        });

        await tx.formation.deleteMany({ where: { userId: id } });
        await tx.formationNode.deleteMany({
          where: { player: { userId: id } },
        });

        await tx.rosterPlayer.deleteMany({
          where: {
            OR: [
              { player: { userId: id } },
              {
                roster: {
                  OR: [{ userId: id }, { tournament: { userId: id } }],
                },
              },
            ],
          },
        });

        await tx.roster.deleteMany({
          where: {
            OR: [{ userId: id }, { tournament: { userId: id } }],
          },
        });

        await tx.player.updateMany({
          where: {
            basePlayer: { userId: id },
            NOT: { userId: id },
          },
          data: { basePlayerId: null },
        });

        await tx.player.deleteMany({ where: { userId: id } });
        await tx.tournament.deleteMany({ where: { userId: id } });
        await tx.pendingRegistration.deleteMany({ where: { email: user.email } });
        await tx.user.delete({ where: { id } });
      },
      { maxWait: 10_000, timeout: 30_000 },
    );
    revalidateTagSafe(cacheTag.rosters(id));
    revalidateTagSafe(cacheTag.rostersTitles(id));
    revalidateTagSafe(cacheTag.tournaments(id));
    revalidateTagSafe(cacheTag.tournamentsNames(id));

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to delete user';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
