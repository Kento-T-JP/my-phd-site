import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import prisma from "@/lib/db";
import React from "react";

async function unwrap(params: Promise<{ id: string }> | { id: string }) {
  if (
    (React as any).use &&
    (React as any).__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED?.ReactCurrentDispatcher.current
  ) {
    return React.use(params as any);
  }
  return params instanceof Promise ? await params : params;
}

export async function PATCH(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await unwrap(params);
  const inquiry = await prisma.contactSubmission.update({
    where: { id },
    data: { status: "handled" },
    select: {
      id: true,
      name: true,
      email: true,
      category: true,
      message: true,
      status: true,
      createdAt: true,
    },
  });
  return NextResponse.json(inquiry);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await unwrap(params);
  await prisma.contactSubmission.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
