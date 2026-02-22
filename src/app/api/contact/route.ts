import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { ContactSchema } from '@/lib/validation/contact';
import type { ContactForm } from '@/lib/validation/contact';
import { randomInt } from 'crypto';
import nodemailer from 'nodemailer';
import { Resend } from 'resend';
import escapeHtml from 'escape-html';
import { verifyCsrfToken } from '@/lib/csrf';
import {
  getContactCategoryEnglishLabel,
  getContactCategoryLabel,
  normalizeContactCategory,
} from '@/lib/contactCategories';

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
  if (process.env.RECAPTCHA_SECRET) {
    try {
      const params = new URLSearchParams({
        secret: process.env.RECAPTCHA_SECRET,
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
  const userAgent = req.headers.get('user-agent');
  const categoryCode = normalizeContactCategory(payload.category);
  const categoryLabel = getContactCategoryLabel(categoryCode);
  const categoryEnglishLabel = getContactCategoryEnglishLabel(categoryCode);

  const details = {
    id,
    name: payload.name,
    email: payload.email,
    categoryCode,
    categoryLabel,
    categoryEnglishLabel,
    message: payload.message,
    ip,
    userAgent: userAgent ?? 'unknown',
  };

  const escaped = {
    id: escapeHtml(details.id),
    name: escapeHtml(details.name),
    email: escapeHtml(details.email),
    categoryCode: escapeHtml(details.categoryCode),
    categoryLabel: escapeHtml(details.categoryLabel),
    categoryEnglishLabel: escapeHtml(details.categoryEnglishLabel),
    message: escapeHtml(details.message),
    ip: escapeHtml(details.ip),
    userAgent: escapeHtml(details.userAgent),
  };
  const escapedMessageHtml = escaped.message.replace(/\n/g, '<br>');

  const text = `[Start XI] 新しいお問い合わせ\n\n` +
    `受付ID: ${details.id}\n` +
    `お名前: ${details.name}\n` +
    `メールアドレス: ${details.email}\n` +
    `カテゴリ: ${details.categoryLabel}\n\n` +
    `お問い合わせ内容:\n${details.message}\n\n` +
    `IP: ${details.ip}\n` +
    `User Agent: ${details.userAgent}\n\n` +
    `--- English ---\n\n` +
    `[Start XI] New Inquiry Received\n\n` +
    `Reference ID: ${details.id}\n` +
    `Name: ${details.name}\n` +
    `Email: ${details.email}\n` +
    `Category: ${details.categoryEnglishLabel}\n\n` +
    `Message:\n${details.message}\n\n` +
    `IP: ${details.ip}\n` +
    `User Agent: ${details.userAgent}`;
  const html = `<!DOCTYPE html><html><body>
    <h2 style="margin:0 0 12px;">Start XI 新規お問い合わせ通知</h2>
    <p><strong>受付ID:</strong> ${escaped.id}</p>
    <p><strong>お名前:</strong> ${escaped.name}</p>
    <p><strong>メールアドレス:</strong> ${escaped.email}</p>
    <p><strong>カテゴリ:</strong> ${escaped.categoryLabel}</p>
    <p><strong>お問い合わせ内容:</strong><br>${escapedMessageHtml}</p>
    <p><strong>IP:</strong> ${escaped.ip}</p>
    <p><strong>User Agent:</strong> ${escaped.userAgent}</p>
    <hr style="margin:20px 0;border:none;border-top:1px solid #cbd5e1;">
    <h2 style="margin:0 0 12px;">[English] New Inquiry Notification</h2>
    <p><strong>Reference ID:</strong> ${escaped.id}</p>
    <p><strong>Name:</strong> ${escaped.name}</p>
    <p><strong>Email:</strong> ${escaped.email}</p>
    <p><strong>Category:</strong> ${escaped.categoryEnglishLabel}</p>
    <p><strong>Message:</strong><br>${escapedMessageHtml}</p>
    <p><strong>IP:</strong> ${escaped.ip}</p>
    <p><strong>User Agent:</strong> ${escaped.userAgent}</p>
  </body></html>`;

  const confirmFrom =
    process.env.CONFIRM_FROM_ADDRESS ||
    process.env.GMAIL_USER ||
    process.env.CONTACT_RECIPIENT;
  const confirmText =
    `Start XI へのお問い合わせありがとうございます。\n` +
    `以下の内容で受け付けました。\n\n` +
    `受付ID: ${details.id}\n` +
    `カテゴリ: ${details.categoryLabel}\n` +
    `お問い合わせ内容:\n${details.message}\n\n` +
    `通常は数営業日以内を目安に返信します。\n\n` +
    `--- English ---\n\n` +
    `Thank you for contacting Start XI.\n` +
    `Your inquiry has been received with the details below.\n\n` +
    `Reference ID: ${details.id}\n` +
    `Category: ${details.categoryEnglishLabel}\n` +
    `Message:\n${details.message}\n\n` +
    `We typically respond within a few business days.`;
  const confirmHtml = `<!DOCTYPE html><html><body>
    <h2 style="margin:0 0 12px;">お問い合わせを受け付けました</h2>
    <p>Start XI へのお問い合わせありがとうございます。以下の内容で受け付けました。</p>
    <p><strong>受付ID:</strong> ${escaped.id}</p>
    <p><strong>カテゴリ:</strong> ${escaped.categoryLabel}</p>
    <p><strong>お問い合わせ内容:</strong><br>${escapedMessageHtml}</p>
    <p>通常は数営業日以内を目安に返信します。</p>
    <hr style="margin:20px 0;border:none;border-top:1px solid #cbd5e1;">
    <h2 style="margin:0 0 12px;">[English] Inquiry Received</h2>
    <p>Thank you for contacting Start XI. We have received your message.</p>
    <p><strong>Reference ID:</strong> ${escaped.id}</p>
    <p><strong>Category:</strong> ${escaped.categoryEnglishLabel}</p>
    <p><strong>Message:</strong><br>${escapedMessageHtml}</p>
    <p>We typically respond within a few business days.</p>
  </body></html>`;

  const savePromise = (async () => {
    try {
      await prisma.contactSubmission.create({
        data: {
          id: details.id,
          name: details.name,
          email: details.email,
          category: details.categoryCode,
          message: details.message,
          ip,
          userAgent,
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
        subject: `【Start XI】新しいお問い合わせ: ${payload.name} 様`,
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
        subject: '【Start XI】お問い合わせ受付のお知らせ',
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
