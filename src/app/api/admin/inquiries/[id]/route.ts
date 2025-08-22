import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import prisma from "@/lib/db";
import React from "react";
import { z } from "zod";

interface ReactWithUse {
  use<T>(value: Promise<T> | T): T;
  __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED?: {
    ReactCurrentDispatcher?: { current: unknown };
  };
}

const AdminInquiryUpdateSchema = z.object({
  status: z.enum(["handled", "received"]),
});

export type AdminInquiryUpdate = z.infer<typeof AdminInquiryUpdateSchema>;

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
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await unwrap(params);
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const parsed = AdminInquiryUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }
  const inquiry = await prisma.contactSubmission.update({
    where: { id },
    data: { status: parsed.data.status },
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
