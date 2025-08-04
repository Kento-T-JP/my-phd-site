import { NextResponse } from "next/server";
import prisma from "@/lib/db";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "Invalid token" }, { status: 400 });
  }
  const record = await prisma.emailVerificationToken.findUnique({ where: { token } });
  if (!record || record.expires < new Date()) {
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 400 });
  }
  await prisma.user.update({
    where: { id: record.userId },
    data: { emailVerified: new Date() },
  });
  await prisma.emailVerificationToken.delete({ where: { token } });
  const redirectUrl = `${process.env.NEXTAUTH_URL || ""}/login`;
  return NextResponse.redirect(redirectUrl);
}
