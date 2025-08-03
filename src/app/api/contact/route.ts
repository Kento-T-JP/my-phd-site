import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { ContactSchema } from '@/lib/validation/contact';
import type { ContactForm } from '@/lib/validation/contact';
import { randomInt } from 'crypto';
import nodemailer from 'nodemailer';
import { Resend } from 'resend';

const WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const MAX_REQUESTS = 5;
const ipHits = new Map<string, { count: number; expires: number }>();

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

const resend = new Resend(process.env.RESEND_API_KEY);

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

  const details = {
    id,
    name: payload.name,
    email: payload.email,
    category: payload.category ?? 'N/A',
    message: payload.message,
    ip,
    userAgent: userAgent ?? 'unknown',
  };

  const text = `New contact submission\n\n` +
    `ID: ${details.id}\n` +
    `Name: ${details.name}\n` +
    `Email: ${details.email}\n` +
    `Category: ${details.category}\n` +
    `Message: ${details.message}\n` +
    `IP: ${details.ip}\n` +
    `User Agent: ${details.userAgent}`;

  const html = `<!DOCTYPE html>` +
    `<html><body>` +
    `<p><strong>ID:</strong> ${details.id}</p>` +
    `<p><strong>Name:</strong> ${details.name}</p>` +
    `<p><strong>Email:</strong> ${details.email}</p>` +
    `<p><strong>Category:</strong> ${details.category}</p>` +
    `<p><strong>Message:</strong> ${details.message}</p>` +
    `<p><strong>IP:</strong> ${details.ip}</p>` +
    `<p><strong>User Agent:</strong> ${details.userAgent}</p>` +
    `</body></html>`;
  try {
    await transporter.sendMail({
      from: `${payload.name} <${payload.email}>`,
      to: process.env.CONTACT_RECIPIENT,
      subject: `SAMURAI BLUE New Contact Submission From ${payload.name}`,
      text,
      html,
      replyTo: payload.email,
    });
  } catch (err) {
    console.error('Failed to send email', err);
  }

  // Send confirmation to the user. Errors here should not affect the API response.
  const confirmFrom =
    process.env.CONFIRM_FROM_ADDRESS ||
    process.env.GMAIL_USER ||
    process.env.CONTACT_RECIPIENT;
  const confirmText =
    `We received your message.\n\n` +
    `Category: ${details.category}\n` +
    `Message: ${details.message}\n\n` +
    `Reference ID: ${details.id}`;
  const confirmHtml = `<!DOCTYPE html>` +
    `<html><body>` +
    `<p>We received your message.</p>` +
    `<p><strong>Category:</strong> ${details.category}</p>` +
    `<p><strong>Message:</strong> ${details.message}</p>` +
    `<p><strong>Reference ID:</strong> ${details.id}</p>` +
    `</body></html>`;
  try {
    await resend.emails.send({
      to: payload.email,
      from: confirmFrom ?? '',
      subject: 'We received your message',
      text: confirmText,
      html: confirmHtml,
    });
  } catch (err) {
    console.error('Failed to send confirmation email', err);
  }

  console.log('contact submission', { id, ip, userAgent });
  return NextResponse.json({ id });
}
