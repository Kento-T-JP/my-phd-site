import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { hash } from "bcrypt";
import { randomBytes } from "crypto";
import { Resend } from "resend";
import escapeHtml from "escape-html";
import { LEGAL_VERSION } from "@/lib/legal";

export async function POST(req: Request) {
  const {
    email,
    password,
    isAdmin = false,
    recaptchaToken,
    agreedToTerms,
    agreedToPrivacy,
    legalVersion,
  } = await req.json();
  if (
    typeof email !== "string" ||
    typeof password !== "string" ||
    typeof isAdmin !== "boolean" ||
    typeof recaptchaToken !== "string" ||
    agreedToTerms !== true ||
    agreedToPrivacy !== true ||
    legalVersion !== LEGAL_VERSION
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
    return NextResponse.json(
      { error: "このメールアドレスは既に使用されています" },
      { status: 400 }
    );
  }

  const hashed = await hash(password, 10);
  const token = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await prisma.pendingRegistration.upsert({
    where: { email },
    update: { hashedPassword: hashed, token, expires },
    create: { email, hashedPassword: hashed, token, expires },
  });

  const resend = new Resend(process.env.RESEND_API_KEY);
  const baseUrl = process.env.NEXTAUTH_URL || "";
  const verifyUrl = `${baseUrl}/api/verify-email?token=${token}`;
  const from =
    process.env.CONFIRM_FROM_ADDRESS || process.env.GMAIL_USER || "";
  const escapedVerifyUrl = escapeHtml(verifyUrl);
  try {
    await resend.emails.send({
      to: email,
      from,
      subject: "【Start XI】メールアドレス確認のお願い",
      text:
        "Start XI への新規登録ありがとうございます。\n\n" +
        "以下のURLを24時間以内に開き、メールアドレス確認を完了してください。\n" +
        `${verifyUrl}\n\n` +
        "このメールに心当たりがない場合は、このまま破棄してください。\n\n" +
        "--- English ---\n\n" +
        "Thank you for creating your Start XI account.\n\n" +
        "Please verify your email address within 24 hours using the link below:\n" +
        `${verifyUrl}\n\n` +
        "If you did not request this email, you can safely ignore it.",
      html:
        "<!DOCTYPE html><html><body style=\"font-family:sans-serif;line-height:1.7;color:#0f172a;\">" +
        "<h2 style=\"margin:0 0 12px;\">Start XI メールアドレス確認</h2>" +
        "<p>Start XI への新規登録ありがとうございます。</p>" +
        "<p>以下のボタンから<strong>24時間以内</strong>に確認を完了してください。</p>" +
        `<p><a href="${escapedVerifyUrl}" style="display:inline-block;padding:10px 16px;border-radius:8px;background:#0ea5e9;color:#ffffff;text-decoration:none;font-weight:600;">メールアドレスを確認する</a></p>` +
        `<p style="word-break:break-all;">ボタンが使えない場合: <a href="${escapedVerifyUrl}">${escapedVerifyUrl}</a></p>` +
        "<p style=\"margin-top:16px;color:#475569;font-size:13px;\">このメールに心当たりがない場合は、このまま破棄してください。</p>" +
        "<hr style=\"margin:20px 0;border:none;border-top:1px solid #cbd5e1;\">" +
        "<h2 style=\"margin:0 0 12px;\">[English] Verify Your Email Address</h2>" +
        "<p>Thank you for creating your Start XI account.</p>" +
        "<p>Please complete email verification within <strong>24 hours</strong> using the button below.</p>" +
        `<p><a href="${escapedVerifyUrl}" style="display:inline-block;padding:10px 16px;border-radius:8px;background:#0ea5e9;color:#ffffff;text-decoration:none;font-weight:600;">Verify Email Address</a></p>` +
        `<p style="word-break:break-all;">If the button does not work: <a href="${escapedVerifyUrl}">${escapedVerifyUrl}</a></p>` +
        "<p style=\"margin-top:16px;color:#475569;font-size:13px;\">If you did not request this email, you can safely ignore it.</p>" +
        "</body></html>",
    });
  } catch (err) {
    console.error("Failed to send verification email", err);
  }

  return NextResponse.json({ ok: true });
}
