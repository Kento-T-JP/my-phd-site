import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import React from 'react';
import { z } from 'zod';

interface ReactWithUse {
  use<T>(value: Promise<T> | T): T;
  __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED?: {
    ReactCurrentDispatcher?: { current: unknown };
  };
}

const AdminUserUpdateSchema = z.object({
  isAdmin: z.boolean(),
});

export type AdminUserUpdate = z.infer<typeof AdminUserUpdateSchema>;

async function unwrap(params: Promise<{ id: string }> | { id: string }) {
  const react = React as unknown as ReactWithUse;
  if (
    react.use &&
    react.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED?.ReactCurrentDispatcher
      ?.current
  ) {
    return react.use(params);
  }
  return params instanceof Promise ? await params : params;
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const unwrapped = await unwrap(params);
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
  const session = await getServerSession(authOptions);
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const unwrapped = await unwrap(params);
  const id = Number(unwrapped.id);
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
  }
  await prisma.user.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
