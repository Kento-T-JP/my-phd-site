import { describe, it, expect, beforeEach, vi } from 'vitest';

let sendMailMock: any;

vi.mock('nodemailer', () => {
  sendMailMock = vi.fn();
  return {
    __esModule: true,
    default: {
      createTransport: vi.fn(() => ({ sendMail: sendMailMock })),
    },
  };
});

vi.mock('@/lib/db', () => {
  return {
    __esModule: true,
    default: { contactSubmission: { create: vi.fn() } },
  };
});

let prisma: any;

beforeEach(async () => {
  vi.resetModules();
  sendMailMock = vi.fn();
  process.env.GMAIL_USER = 'user@test';
  process.env.GMAIL_APP_PASSWORD = 'pass';
  process.env.CONTACT_RECIPIENT = 'recipient@test';

  const mod = await import('@/lib/db');
  prisma = mod.default as any;
  prisma.contactSubmission.create.mockReset();
});

describe('contact API route', () => {
  it('returns id and saves to database on success', async () => {
    const { POST } = await import('../src/app/api/contact/route');
    prisma.contactSubmission.create.mockResolvedValue({});
    const req = new Request('http://test', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-forwarded-for': '1.1.1.1',
        'user-agent': 'test-agent',
      },
      body: JSON.stringify({
        name: 'Bob',
        email: 'bob@example.com',
        message: 'Hello',
        category: 'General',
        consent: true,
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.id).toMatch(/^C-\d+$/);
    expect(prisma.contactSubmission.create).toHaveBeenCalledTimes(1);
    expect(prisma.contactSubmission.create.mock.calls[0][0]).toMatchObject({
      data: expect.objectContaining({
        id: data.id,
        name: 'Bob',
        email: 'bob@example.com',
        message: 'Hello',
        ip: '1.1.1.1',
        userAgent: 'test-agent',
      }),
    });
    expect(sendMailMock).toHaveBeenCalledTimes(1);
    const mailPayload = sendMailMock.mock.calls[0][0];
    expect(mailPayload).toMatchObject({
      from: 'Bob <bob@example.com>',
      to: process.env.CONTACT_RECIPIENT,
      replyTo: 'bob@example.com',
      text: expect.any(String),
      html: expect.any(String),
    });
    expect(mailPayload.text).toContain(`ID: ${data.id}`);
    expect(mailPayload.text).toContain('Name: Bob');
    expect(mailPayload.text).toContain('Email: bob@example.com');
    expect(mailPayload.text).toContain('Category: General');
    expect(mailPayload.text).toContain('Message: Hello');
    expect(mailPayload.text).toContain('IP: 1.1.1.1');
    expect(mailPayload.text).toContain('User Agent: test-agent');
  });

  it('returns 400 for missing required fields', async () => {
    const { POST } = await import('../src/app/api/contact/route');
    const req = new Request('http://test', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(prisma.contactSubmission.create).not.toHaveBeenCalled();
    expect(sendMailMock).not.toHaveBeenCalled();
  });

  it('returns 400 for invalid email', async () => {
    const { POST } = await import('../src/app/api/contact/route');
    const req = new Request('http://test', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Bob',
        email: 'invalid',
        message: 'Hi',
        consent: true,
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(prisma.contactSubmission.create).not.toHaveBeenCalled();
     expect(sendMailMock).not.toHaveBeenCalled();
  });

  it('rejects submissions when honeypot field is filled', async () => {
    const { POST } = await import('../src/app/api/contact/route');
    const req = new Request('http://test', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Bob',
        email: 'bob@example.com',
        message: 'Hi',
        consent: true,
        honeypot: 'spam',
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(prisma.contactSubmission.create).not.toHaveBeenCalled();
    expect(sendMailMock).not.toHaveBeenCalled();
  });

  it('enforces rate limiting by ip', async () => {
    const { POST } = await import('../src/app/api/contact/route');
    prisma.contactSubmission.create.mockResolvedValue({});
    const payload = {
      name: 'Bob',
      email: 'bob@example.com',
      message: 'Hi',
      consent: true,
    };
    for (let i = 0; i < 5; i++) {
      const req = new Request('http://test', {
        method: 'POST',
        headers: { 'x-forwarded-for': '9.9.9.9' },
        body: JSON.stringify(payload),
      });
      const res = await POST(req);
      expect(res.status).toBe(200);
    }
    const blockedReq = new Request('http://test', {
      method: 'POST',
      headers: { 'x-forwarded-for': '9.9.9.9' },
      body: JSON.stringify(payload),
    });
    const blockedRes = await POST(blockedReq);
    expect(blockedRes.status).toBe(429);
    expect(prisma.contactSubmission.create).toHaveBeenCalledTimes(5);
    expect(sendMailMock).toHaveBeenCalledTimes(5);
  });
});

