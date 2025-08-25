import { NextResponse, type NextRequest } from 'next/server';
import { getToken, type JWT } from 'next-auth/jwt';
import { chain, csp, nextSafe } from '@next-safe/middleware';

const authMiddleware = async (req: NextRequest) => {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) {
    const token: (JWT & { isAdmin?: boolean }) | null = await getToken({ req });
    if (token?.isAdmin !== true) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      const loginUrl = new URL('/login', req.url);
      return NextResponse.redirect(loginUrl);
    }
  }
  return NextResponse.next();
};

export const middleware = chain(
  authMiddleware,
  nextSafe({
    disableCsp: true,
    frameOptions: 'DENY',
    contentTypeOptions: 'nosniff',
    referrerPolicy: 'strict-origin-when-cross-origin',
    isDev: process.env.NODE_ENV === 'development',
  }),
  csp({
    directives: {
      'default-src': ['self'],
      'frame-ancestors': ['self'],
      'img-src': ['self', 'data:', 'blob:'],
      'script-src': [
        'self',
        ...(process.env.NODE_ENV === 'development'
          ? ['unsafe-eval', 'unsafe-inline']
          : []),
      ],
      'style-src': [
        'self',
        ...(process.env.NODE_ENV === 'development' ? ['unsafe-inline'] : []),
      ],
      'connect-src': [
        'self',
        ...(process.env.NODE_ENV === 'development'
          ? ['ws://localhost:*', 'http://localhost:*']
          : []),
      ],
    },
    isDev: process.env.NODE_ENV === 'development',
  }),
);

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
};

