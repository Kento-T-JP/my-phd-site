import { NextResponse, type NextRequest } from 'next/server';
import { getToken, type JWT } from 'next-auth/jwt';

const ContentSecurityPolicy = `
  default-src 'self';
  script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.google.com https://www.gstatic.com https://www.recaptcha.net;
  style-src 'self' 'unsafe-inline' https://www.google.com https://www.gstatic.com https://www.recaptcha.net;
  img-src 'self' data: https://www.google.com https://www.gstatic.com https://www.recaptcha.net;
  connect-src 'self' https://www.google.com https://www.gstatic.com https://www.recaptcha.net;
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

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token: (JWT & { isAdmin?: boolean; userStatus?: string }) | null = await getToken({
    req,
  });
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

  const status = token?.userStatus;
  if (status && status !== 'active') {
    const allowedPaths = [
      '/access-status',
      '/google-consent',
      '/login',
      '/register',
      '/contact',
      '/api/auth',
      '/api/auth/google-consent',
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
