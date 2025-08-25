import '@testing-library/jest-dom/vitest';
import React from 'react';
import { vi } from 'vitest';

vi.mock('next/image', () => ({
  __esModule: true,
  default: (props: any) => React.createElement('img', props),
}));

vi.mock('next/link', () => ({
  __esModule: true,
  default: (props: any) => React.createElement('a', props),
}));

vi.mock('next-auth/react', async () => {
  const mod = await vi.importActual<any>('next-auth/react');
  return {
    ...mod,
    getCsrfToken: vi.fn().mockResolvedValue('test-csrf'),
  };
});

const OriginalRequest = Request;
class TestRequest extends OriginalRequest {
  constructor(input: RequestInfo, init: RequestInit = {}) {
    const headers = new Headers(init.headers);
    const token = 'test-csrf';
    headers.set('X-CSRF-Token', token);
    const existing = headers.get('cookie');
    headers.set(
      'cookie',
      existing ? `${existing}; next-auth.csrf-token=${token}` : `next-auth.csrf-token=${token}`,
    );
    super(input, { ...init, headers });
  }
}
// @ts-ignore
global.Request = TestRequest;
