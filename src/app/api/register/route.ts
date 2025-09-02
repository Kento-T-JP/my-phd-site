import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { hash } from "bcrypt";
import { randomBytes } from "crypto";
import { Resend } from "resend";

export async function POST(req: Request) {
  const { email, password, isAdmin = false, recaptchaToken } = await req.json();
  if (
    typeof email !== "string" ||
    typeof password !== "string" ||
    typeof isAdmin !== "boolean" ||
    typeof recaptchaToken !== "string"
  ) {
    return NextResponse.json({ error: "無効な入力です" }, { status: 400 });
  }

  try {
    const params = new URLSearchParams({
      secret: process.env.RECAPTCHA_SECRET || "",
      response: recaptchaToken,
    });
    const verify = await fetch(
      "https://www.google.com/recaptcha/api/siteverify",
      { method: "POST", body: params }
    ).then((res) => res.json());
    if (!verify.success) {
      return NextResponse.json(
        { error: "Failed captcha verification" },
        { status: 400 }
      );
    }
  } catch {
    return NextResponse.json(
      { error: "Failed captcha verification" },
      { status: 400 }
    );
  }
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "このメールアドレスは既に使用されています" }, { status: 400 });
  }
  const hashed = await hash(password, 10);
  const user = await prisma.user.create({
    data: { email, hashedPassword: hashed, isAdmin },
  });

  const token = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await prisma.emailVerificationToken.create({
    data: { token, userId: user.id, expires },
  });

  const resend = new Resend(process.env.RESEND_API_KEY);
  const baseUrl = process.env.NEXTAUTH_URL || "";
  const verifyUrl = `${baseUrl}/api/verify-email?token=${token}`;
  const from =
    process.env.CONFIRM_FROM_ADDRESS || process.env.GMAIL_USER || "";
  try {
    await resend.emails.send({
      to: email,
      from,
      subject: "Verify your email",
      html: `<p>Please verify your email by clicking <a href="${verifyUrl}">this link</a>.</p>`,
      text: `Please verify your email: ${verifyUrl}`,
    });
  } catch (err) {
    console.error("Failed to send verification email", err);
  }

  return NextResponse.json({ id: user.id, email: user.email, isAdmin: user.isAdmin });
}

