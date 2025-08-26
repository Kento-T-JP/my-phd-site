import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { ContactSchema } from '@/lib/validation/contact';
import type { ContactForm } from '@/lib/validation/contact';
import { randomInt } from 'crypto';
import nodemailer from 'nodemailer';
import { Resend } from 'resend';
import escapeHtml from 'escape-html';
import { verifyCsrfToken } from '@/lib/csrf';
import isBot from '@/lib/isBot';

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
  if (!verifyCsrfToken(req)) {
    return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
  }
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown';
  const userAgent = req.headers.get('user-agent') || undefined;

  if (isBot(userAgent)) {
    return NextResponse.json({ error: 'Invalid submission' }, { status: 400 });
  }

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
  } catch {
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

  const details = {
    id,
    name: payload.name,
    email: payload.email,
    category: payload.category ?? 'N/A',
    message: payload.message,
    ip,
    userAgent: userAgent ?? 'unknown',
  };

  const escaped = {
    id: escapeHtml(details.id),
    name: escapeHtml(details.name),
    email: escapeHtml(details.email),
    category: escapeHtml(details.category),
    message: escapeHtml(details.message),
    ip: escapeHtml(details.ip),
    userAgent: escapeHtml(details.userAgent),
  };

  const text = `New contact submission\n\n` +
    `ID: ${details.id}\n` +
    `Name: ${details.name}\n` +
    `Email: ${details.email}\n` +
    `Category: ${details.category}\n` +
    `Message: ${details.message}\n` +
    `IP: ${details.ip}\n` +
    `User Agent: ${details.userAgent}`;
  const html = `<!DOCTYPE html><html><body>
    <p><strong>ID:</strong> ${escaped.id}</p>
    <p><strong>Name:</strong> ${escaped.name}</p>
    <p><strong>Email:</strong> ${escaped.email}</p>
    <p><strong>Category:</strong> ${escaped.category}</p>
    <p><strong>Message:</strong> ${escaped.message}</p>
    <p><strong>IP:</strong> ${escaped.ip}</p>
    <p><strong>User Agent:</strong> ${escaped.userAgent}</p>
  </body></html>`;

  const confirmFrom =
    process.env.CONFIRM_FROM_ADDRESS ||
    process.env.GMAIL_USER ||
    process.env.CONTACT_RECIPIENT;
  const confirmText =
    `Thank you for your inquiry. We received your message.\n\n` +
    `Category: ${details.category}\n` +
    `Message: ${details.message}\n\n` +
    `Reference ID: ${details.id}`;
  const confirmHtml = `<!DOCTYPE html><html><body>
    <p>We received your message.</p>
    <p><strong>Category:</strong> ${escaped.category}</p>
    <p><strong>Message:</strong> ${escaped.message}</p>
    <p><strong>Reference ID:</strong> ${escaped.id}</p>
  </body></html>`;

  const savePromise = (async () => {
    try {
      await prisma.contactSubmission.create({
        data: {
          id: details.id,
          name: details.name,
          email: details.email,
          category: details.category,
          message: details.message,
          ip,
          userAgent,
          isBot: false,
        },
      });
    } catch (err) {
      console.error('Failed to save message', err);
      throw new Error('save');
    }
  })();

  const ownerMailPromise = (async () => {
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
      console.error('Failed to send notification email', err);
      throw new Error('owner');
    }
  })();

  const confirmMailPromise = (async () => {
    try {
      await resend.emails.send({
        to: payload.email,
        from: confirmFrom ?? '',
        subject: 'Start-XI: We received your message',
        text: confirmText,
        html: confirmHtml,
      });
    } catch (err) {
      console.error('Failed to send confirmation email', err);
      throw new Error('confirm');
    }
  })();

  try {
    await Promise.all([savePromise, ownerMailPromise, confirmMailPromise]);
  } catch (err) {
    if (err instanceof Error) {
      switch (err.message) {
        case 'save':
          return NextResponse.json(
            { error: 'Failed to save message' },
            { status: 500 },
          );
        case 'owner':
          return NextResponse.json(
            { error: 'Failed to send notification email' },
            { status: 500 },
          );
        case 'confirm':
          return NextResponse.json(
            { error: 'Failed to send confirmation email' },
            { status: 500 },
          );
      }
    }
    return NextResponse.json(
      { error: 'Failed to process submission' },
      { status: 500 },
    );
  }

  console.log('contact submission', { id, ip, userAgent });
  return NextResponse.json({ id });
}
