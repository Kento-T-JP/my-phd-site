import { NextResponse } from 'next/server';
import prisma, { getPlayers } from '@/lib/db';
import React from 'react';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  let unwrapped;
  if (
    (React as any).use &&
    (React as any).__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED?.ReactCurrentDispatcher.current
  ) {
    unwrapped = React.use(params as any);
  } else {
    unwrapped = await params;
  }
  const id = Number(unwrapped.id);
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }
  const roster = await prisma.roster.findUnique({ where: { id } });
  if (!roster) {
    return NextResponse.json({ error: 'Roster not found' }, { status: 404 });
  }
  const players = await getPlayers(id);
  return NextResponse.json(players);
}
