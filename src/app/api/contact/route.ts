import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { ContactSchema } from '@/lib/validation/contact';
import type { ContactForm } from '@/lib/validation/contact';
import { randomInt } from 'crypto';
import nodemailer from 'nodemailer';

const WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const MAX_REQUESTS = 5;
const ipHits = new Map<string, { count: number; expires: number }>();

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = ipHits.get(ip);
  if (!entry || now > entry.expires) {
    ipHits.set(ip, { count: 1, expires: now + WINDOW_MS });
    return false;
  }
  entry.count++;
  if (entry.count > MAX_REQUESTS) {
    return true;
  }
  return false;
}

async function verifyToken(token: string | undefined, ip: string) {
  if (!token) return true;
  if (process.env.TURNSTILE_SECRET_KEY) {
    try {
      const resp = await fetch(
        'https://challenges.cloudflare.com/turnstile/v0/siteverify',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            secret: process.env.TURNSTILE_SECRET_KEY,
            response: token,
            remoteip: ip,
          }),
        },
      );
      const data = await resp.json();
      return data.success === true;
    } catch {
      return false;
    }
  }
  if (process.env.RECAPTCHA_SECRET_KEY) {
    try {
      const params = new URLSearchParams({
        secret: process.env.RECAPTCHA_SECRET_KEY,
        response: token,
        remoteip: ip,
      });
      const resp = await fetch(
        'https://www.google.com/recaptcha/api/siteverify',
        {
          method: 'POST',
          body: params,
        },
      );
      const data = await resp.json();
      return data.success === true;
    } catch {
      return false;
    }
  }
  // No verification configured
  return true;
}

export async function POST(req: Request) {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown';

  if (checkRateLimit(ip)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  let payload: ContactForm;
  try {
    const json = await req.json();
    const parsed = ContactSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 },
      );
    }
    payload = parsed.data;
  } catch (err) {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Honeypot check
  if (payload.honeypot) {
    return NextResponse.json({ error: 'Invalid submission' }, { status: 400 });
  }

  // Verify captcha if provided
  const validCaptcha = await verifyToken(payload.token, ip);
  if (!validCaptcha) {
    return NextResponse.json(
      { error: 'Failed captcha verification' },
      { status: 400 },
    );
  }

  const id = `C-${randomInt(1000, 10000)}`;
  const userAgent = req.headers.get('user-agent');

  try {
    await (prisma as any).contactSubmission.create({
      data: {
        id,
        name: payload.name,
        email: payload.email,
        message: payload.message,
        ip,
        userAgent,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to save message' },
      { status: 500 },
    );
  }
  try {
    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: process.env.CONTACT_RECIPIENT,
      subject: `New contact submission from ${payload.name}`,
      text: `Name: ${payload.name}\nEmail: ${payload.email}\n\n${payload.message}`,
    });
  } catch (err) {
    console.error('Failed to send email', err);
  }

  console.log('contact submission', { id, ip, userAgent });
  return NextResponse.json({ id });
}
