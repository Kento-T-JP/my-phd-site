import { describe, expect, it } from 'vitest';
import { verifyCsrfToken } from '@/lib/csrf';

function makeReq(headerToken: string | null, cookieHeader: string | null): Request {
  return {
    headers: {
      get(name: string) {
        const key = name.toLowerCase();
        if (key === 'x-csrf-token') return headerToken;
        if (key === 'cookie') return cookieHeader;
        return null;
      },
    },
  } as unknown as Request;
}

describe('verifyCsrfToken', () => {
  it('accepts standard next-auth csrf cookie', () => {
    const req = makeReq('abc123', 'next-auth.csrf-token=abc123%7Chash');
    expect(verifyCsrfToken(req)).toBe(true);
  });

  it('accepts host-prefixed csrf cookie', () => {
    const req = makeReq('abc123', '__Host-next-auth.csrf-token=abc123%7Chash');
    expect(verifyCsrfToken(req)).toBe(true);
  });

  it('accepts when multiple csrf cookies exist and one matches', () => {
    const req = makeReq(
      'new-token',
      'next-auth.csrf-token=old-token%7Cold; __Host-next-auth.csrf-token=new-token%7Cnew',
    );
    expect(verifyCsrfToken(req)).toBe(true);
  });

  it('rejects when no csrf cookie matches header token', () => {
    const req = makeReq('abc123', 'next-auth.csrf-token=xyz789%7Chash');
    expect(verifyCsrfToken(req)).toBe(false);
  });
});
