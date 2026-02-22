import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/authOptions';

export async function GET() {
  const session = (await getServerSession(authOptions)) as { user?: { id?: string; email?: string; isAdmin?: boolean; status?: string }; loginStage?: string; gatePassed?: boolean } | null;
  const isAdmin = Boolean((session?.user as { isAdmin?: boolean } | undefined)?.isAdmin);
  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      emailVerified: true,
      isAdmin: true,
      termsAcceptedAt: true,
      privacyAcceptedAt: true,
      legalVersionAccepted: true,
    },
  });
  return NextResponse.json(users);
}
