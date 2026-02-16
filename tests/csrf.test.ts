import { describe, expect, it } from 'vitest';

import { verifyCsrfToken } from '@/lib/csrf';

const makeRequest = (
  csrfHeader?: string,
  cookieHeader?: string,
): Request => {
  const headers = new Headers();
  if (csrfHeader) headers.set('x-csrf-token', csrfHeader);
  if (cookieHeader) headers.set('cookie', cookieHeader);
  return { headers } as Request;
};

describe('verifyCsrfToken', () => {
  it('accepts the legacy next-auth csrf cookie', () => {
    const req = makeRequest(
      'test-token',
      'next-auth.csrf-token=test-token%7Chash; foo=bar',
    );

    expect(verifyCsrfToken(req)).toBe(true);
  });

  it('accepts __Host-next-auth csrf cookie', () => {
    const req = makeRequest(
      'host-token',
      '__Host-next-auth.csrf-token=host-token%7Chash; foo=bar',
    );

    expect(verifyCsrfToken(req)).toBe(true);
  });

  it('accepts when multiple csrf cookies exist and one matches', () => {
    const req = makeRequest(
      'current-token',
      [
        'next-auth.csrf-token=stale-token%7Coldhash',
        '__Host-next-auth.csrf-token=current-token%7Cnewhash',
      ].join('; '),
    );

    expect(verifyCsrfToken(req)).toBe(true);
  });

  it('rejects when csrf header token does not match any csrf cookie', () => {
    const req = makeRequest(
      'header-token',
      '__Host-next-auth.csrf-token=other-token%7Chash',
    );

    expect(verifyCsrfToken(req)).toBe(false);
  });
});
