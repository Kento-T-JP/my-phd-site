import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function POST(req: NextRequest) {
  const { path } = await req.json().catch(() => ({ path: undefined }));
  if (!path) {
    return NextResponse.json({ error: 'Path required' }, { status: 400 });
  }
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0];
  const userAgent = req.headers.get('user-agent') || undefined;
  await prisma.visit.create({
    data: { path, ip, userAgent },
  });
  return NextResponse.json({ success: true });
}
