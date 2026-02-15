import { NextResponse } from "next/server";
import prisma from "@/lib/db";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "Invalid token" }, { status: 400 });
  }
  const record = await prisma.pendingRegistration.findUnique({ where: { token } });
  if (!record || record.expires < new Date()) {
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 400 });
  }
  const existing = await prisma.user.findUnique({ where: { email: record.email } });
  if (existing) {
    await prisma.user.update({
      where: { email: record.email },
      data: { emailVerified: new Date(), status: "active" },
    });
  } else {
    await prisma.user.create({
      data: {
        email: record.email,
        hashedPassword: record.hashedPassword,
        status: "active",
        emailVerified: new Date(),
      },
    });
  }
  await prisma.pendingRegistration.delete({ where: { token } });
  const redirectUrl = `${process.env.NEXTAUTH_URL || ""}/login`;
  return NextResponse.redirect(redirectUrl);
}
