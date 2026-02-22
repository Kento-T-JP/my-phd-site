import { describe, it, expect, beforeEach, vi } from 'vitest';

let sendMailMock: any;
let resendSendMock: any;
let sendGridSendMock: any;

vi.mock('nodemailer', () => {
  sendMailMock = vi.fn().mockResolvedValue({});
  return {
    __esModule: true,
    default: {
      createTransport: vi.fn(() => ({ sendMail: sendMailMock })),
    },
  };
});

vi.mock('resend', () => {
  resendSendMock = vi.fn().mockResolvedValue({});
  return {
    __esModule: true,
    Resend: vi.fn(() => ({ emails: { send: resendSendMock } })),
  };
});

vi.mock('@sendgrid/mail', () => {
  sendGridSendMock = vi.fn().mockResolvedValue({});
  return {
    __esModule: true,
    default: { setApiKey: vi.fn(), send: sendGridSendMock },
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
  sendMailMock = vi.fn().mockResolvedValue({});
  resendSendMock = vi.fn().mockResolvedValue({});
  sendGridSendMock = vi.fn().mockResolvedValue({});
  process.env.GMAIL_USER = 'user@test';
  process.env.GMAIL_APP_PASSWORD = 'pass';
  process.env.CONTACT_RECIPIENT = 'recipient@test';
  process.env.RESEND_API_KEY = 'test';
  delete process.env.SENDGRID_API_KEY;
  process.env.CONFIRM_FROM_ADDRESS = 'no-reply@test';

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
    const ownerPayload = sendMailMock.mock.calls[0][0];
    expect(ownerPayload).toMatchObject({
      from: 'Bob <bob@example.com>',
      to: process.env.CONTACT_RECIPIENT,
      replyTo: 'bob@example.com',
      text: expect.any(String),
      html: expect.any(String),
    });
    expect(ownerPayload.text).toContain(`受付ID: ${data.id}`);
    expect(ownerPayload.text).toContain('お名前: Bob');
    expect(ownerPayload.text).toContain('メールアドレス: bob@example.com');
    expect(ownerPayload.text).toContain('カテゴリ: その他');
    expect(ownerPayload.text).toContain('お問い合わせ内容:\nHello');
    expect(ownerPayload.text).toContain('IP: 1.1.1.1');
    expect(ownerPayload.text).toContain('User Agent: test-agent');

    expect(resendSendMock).toHaveBeenCalledTimes(1);
    expect(sendGridSendMock).not.toHaveBeenCalled();
    const userPayload = resendSendMock.mock.calls[0][0];
    expect(userPayload).toMatchObject({
      to: 'bob@example.com',
      from: process.env.CONFIRM_FROM_ADDRESS,
      subject: expect.stringContaining('お問い合わせ受付のお知らせ'),
      text: expect.any(String),
      html: expect.any(String),
    });
    expect(userPayload.text).toContain(`カテゴリ: その他`);
    expect(userPayload.text).toContain(`お問い合わせ内容:\nHello`);
    expect(userPayload.text).toContain(`受付ID: ${data.id}`);
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
    expect(resendSendMock).not.toHaveBeenCalled();
    expect(sendGridSendMock).not.toHaveBeenCalled();
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
    expect(resendSendMock).not.toHaveBeenCalled();
    expect(sendGridSendMock).not.toHaveBeenCalled();
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
    expect(resendSendMock).not.toHaveBeenCalled();
    expect(sendGridSendMock).not.toHaveBeenCalled();
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
    expect(resendSendMock).toHaveBeenCalledTimes(5);
    expect(sendGridSendMock).not.toHaveBeenCalled();
  });
});
