import { NextResponse, type NextRequest } from 'next/server';
import { getToken, type JWT } from 'next-auth/jwt';

const ContentSecurityPolicy = `
  default-src 'self';
  script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.google.com https://www.gstatic.com https://www.recaptcha.net;
  style-src 'self' 'unsafe-inline' https://www.google.com https://www.gstatic.com https://www.recaptcha.net;
  img-src 'self' data: blob: https://www.google.com https://www.gstatic.com https://www.recaptcha.net;
  connect-src 'self' https://www.google.com https://www.gstatic.com https://www.recaptcha.net https://rest.ably.io https://realtime.ably.io https://*.ably-realtime.com wss://realtime.ably.io wss://*.ably-realtime.com;
  font-src 'self';
  frame-src 'self' https://www.google.com https://www.recaptcha.net;
`;

const securityHeaders: Record<string, string> = {
  'Content-Security-Policy': ContentSecurityPolicy.replace(/\n/g, ' '),
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
};

const applySecurityHeaders = (res: NextResponse) => {
  Object.entries(securityHeaders).forEach(([key, value]) => {
    res.headers.set(key, value);
  });
  return res;
};

const isGateEnabled = (value?: string): boolean => {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return !['false', '0', 'off', 'no'].includes(normalized);
};

const isDebugMiddlewareLogsEnabled = (): boolean =>
  isGateEnabled(process.env.DEBUG_MIDDLEWARE_TOKEN_LOGS);

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token:
    | (JWT & { isAdmin?: boolean; userStatus?: string; loginStage?: string; gatePassed?: boolean })
    | null = await getToken({ req });
  if (
    isDebugMiddlewareLogsEnabled() &&
    (pathname === '/' ||
      pathname.startsWith('/home') ||
      pathname.startsWith('/api/auth/session'))
  ) {
    const cookieHeader = req.headers.get('cookie') ?? '';
    const cookieNames = cookieHeader
      .split(';')
      .map((c) => c.trim().split('=')[0])
      .filter(Boolean);
    console.log('MW_TOKEN', {
      path: pathname,
      cookieLength: cookieHeader.length,
      cookieNames,
      tokenId: token?.id ?? null,
      gatePassed: token?.gatePassed ?? null,
      loginStage: token?.loginStage ?? null,
    });
  }
  if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) {
    if (token?.isAdmin !== true) {
      if (pathname.startsWith('/api/')) {
        return applySecurityHeaders(
          NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
        );
      }
      const loginUrl = new URL('/login', req.url);
      return applySecurityHeaders(NextResponse.redirect(loginUrl));
    }
  }

  const gateEnabled = isGateEnabled(process.env.GATE_ENABLED);
  if (gateEnabled) {
    const gateAllowedPaths = [
      '/',
      '/share',
      '/api/formation-shares',
      '/api/cron',
      '/api/realtime',
      '/api/auth',
      '/api/debug-session',
      '/api/auth/callback/credentials',
    ];
    const stageAllowedPaths = [
      '/login',
      '/access-status',
      '/api/realtime',
      '/api/auth',
      '/api/debug-session',
      '/api/auth/callback/credentials',
    ];

    if (!token?.gatePassed) {
      const isAllowed = gateAllowedPaths.some((path) => pathname.startsWith(path));
      if (!isAllowed) {
        if (pathname.startsWith('/api/')) {
          return applySecurityHeaders(
            NextResponse.json({ error: 'Gate required' }, { status: 401 }),
          );
        }
        const redirectUrl = new URL('/', req.url);
        return applySecurityHeaders(NextResponse.redirect(redirectUrl));
      }
    } else if (token.loginStage !== 'credentials') {
      const isAllowed = stageAllowedPaths.some((path) => pathname.startsWith(path));
      if (!isAllowed) {
        if (pathname.startsWith('/api/')) {
          return applySecurityHeaders(
            NextResponse.json({ error: 'Credential login required' }, { status: 401 }),
          );
        }
        const redirectUrl = new URL('/login', req.url);
        return applySecurityHeaders(NextResponse.redirect(redirectUrl));
      }
    }
  }

  const status = token?.userStatus;
  if (status && status !== 'active') {
    const allowedPaths = [
      '/access-status',
      '/login',
      '/register',
      '/share',
      '/api/formation-shares',
      '/api/cron',
      '/api/realtime',
      '/contact',
      '/api/auth',
      '/api/register',
      '/api/verify-email',
    ];
    const isAllowed = allowedPaths.some((path) => pathname.startsWith(path));
    if (!isAllowed) {
      if (pathname.startsWith('/api/')) {
        return applySecurityHeaders(
          NextResponse.json({ error: 'Access denied' }, { status: 403 }),
        );
      }
      const redirectUrl = new URL('/access-status', req.url);
      redirectUrl.searchParams.set('status', status);
      return applySecurityHeaders(NextResponse.redirect(redirectUrl));
    }
  }

  return applySecurityHeaders(NextResponse.next());
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
