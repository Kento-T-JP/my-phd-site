import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { hash } from "bcrypt";

export async function POST(req: Request) {
  const { email, password, isAdmin = false } = await req.json();
  if (
    typeof email !== "string" ||
    typeof password !== "string" ||
    typeof isAdmin !== "boolean"
  ) {
    return NextResponse.json({ error: "無効な入力です" }, { status: 400 });
  }
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "このメールアドレスは既に使用されています" }, { status: 400 });
  }
  const hashed = await hash(password, 10);
  const user = await prisma.user.create({
    data: { email, hashedPassword: hashed, isAdmin },
  });
  return NextResponse.json({ id: user.id, email: user.email, isAdmin: user.isAdmin });
}

