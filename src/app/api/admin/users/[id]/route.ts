import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/authOptions';
import { z } from 'zod';
import { unwrapParams } from '@/lib/unwrap';


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

  await prisma.$transaction(async (tx) => {
    const ownedTournaments = await tx.tournament.findMany({
      where: { userId: id },
      select: { id: true },
    });
    const ownedTournamentIds = ownedTournaments.map((t) => t.id);

    const ownedPlayers = await tx.player.findMany({
      where: { userId: id },
      select: { id: true },
    });
    const ownedPlayerIds = ownedPlayers.map((p) => p.id);

    const ownedRosters = await tx.roster.findMany({
      where: {
        OR: [
          { userId: id },
          ...(ownedTournamentIds.length > 0
            ? [{ tournamentId: { in: ownedTournamentIds } }]
            : []),
        ],
      },
      select: { id: true },
    });
    const ownedRosterIds = ownedRosters.map((r) => r.id);

    await tx.favoritePlayer.deleteMany({ where: { userId: id } });
    if (ownedPlayerIds.length > 0) {
      await tx.favoritePlayer.deleteMany({
        where: { playerId: { in: ownedPlayerIds } },
      });
    }

    await tx.formation.deleteMany({ where: { userId: id } });
    if (ownedPlayerIds.length > 0) {
      await tx.formationNode.deleteMany({
        where: { playerId: { in: ownedPlayerIds } },
      });
    }

    if (ownedRosterIds.length > 0) {
      await tx.rosterPlayer.deleteMany({
        where: { rosterId: { in: ownedRosterIds } },
      });
    }
    if (ownedPlayerIds.length > 0) {
      await tx.rosterPlayer.deleteMany({
        where: { playerId: { in: ownedPlayerIds } },
      });
    }

    if (ownedPlayerIds.length > 0) {
      await tx.player.updateMany({
        where: {
          basePlayerId: { in: ownedPlayerIds },
          NOT: { userId: id },
        },
        data: { basePlayerId: null },
      });
    }

    if (ownedRosterIds.length > 0) {
      await tx.roster.deleteMany({ where: { id: { in: ownedRosterIds } } });
    }
    if (ownedTournamentIds.length > 0) {
      await tx.tournament.deleteMany({ where: { id: { in: ownedTournamentIds } } });
    }
    await tx.player.deleteMany({ where: { userId: id } });

    await tx.pendingRegistration.deleteMany({ where: { email: user.email } });

    await tx.user.delete({ where: { id } });
  });

  return NextResponse.json({ success: true });
}
