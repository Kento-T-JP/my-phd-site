import NextAuth, { type NextAuthOptions, type User } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import { compare } from 'bcrypt';
import { timingSafeEqual } from 'crypto';

import prisma from '@/lib/prisma';

const parseAllowedEmails = (value?: string): string[] =>
  value
    ? value
        .split(',')
        .map((entry) => entry.trim().toLowerCase())
        .filter(Boolean)
    : [];

const isGateEnabled = (value?: string): boolean => {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return !['false', '0', 'off', 'no'].includes(normalized);
};

const isValidIntId = (value: number): boolean =>
  Number.isSafeInteger(value) && value > 0 && value <= 2147483647;

const resolveUserStatus = async (user: User): Promise<string> => {
  if (user.id === 'gate') {
    return 'active';
  }
  if (user.id === 'admin') {
    return 'active';
  }
  const numericId = Number(user.id);
  const record = Number.isNaN(numericId) || !isValidIntId(numericId)
    ? null
    : await prisma.user.findUnique({
        where: { id: numericId },
        select: { status: true },
      });
  return user.status ?? record?.status ?? 'pending';
};

const resolveUserStatusById = async (id?: string): Promise<string> => {
  if (!id) {
    return 'pending';
  }
  if (id === 'gate') {
    return 'active';
  }
  if (id === 'admin') {
    return 'active';
  }
  const numericId = Number(id);
  if (Number.isNaN(numericId) || !isValidIntId(numericId)) {
    return 'pending';
  }
  const record = await prisma.user.findUnique({
    where: { id: numericId },
    select: { status: true },
  });
  return record?.status ?? 'pending';
};

const buildAccessStatusUrl = (status: string, email?: string): string | null => {
  const baseUrl = process.env.NEXTAUTH_URL;
  if (!baseUrl) {
    return null;
  }
  const url = new URL('/access-status', baseUrl);
  url.searchParams.set('status', status);
  if (email) {
    url.searchParams.set('email', email);
  }
  return url.toString();
};

export const authOptions: NextAuthOptions = {
  trustHost: true,
  debug: true,
  useSecureCookies: false,
  cookies: {
    sessionToken: {
      name: 'next-auth.session-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: false,
      },
    },
  },
  logger: {
    error(code, metadata) {
      console.error('NEXTAUTH_ERROR', code, metadata);
    },
    warn(code) {
      console.warn('NEXTAUTH_WARN', code);
    },
    debug(code, metadata) {
      console.log('NEXTAUTH_DEBUG', code, metadata);
    },
  },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      authorization: {
        params: {
          prompt: 'select_account',
        },
      },
    }),
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'text' },
        password: { label: 'Password', type: 'password' },
        captcha: { label: 'Captcha', type: 'text' },
      },
      async authorize(credentials, req): Promise<User | null> {
        if (!credentials?.email || !credentials.password) return null;

        console.log('CRED_START', {
          email: credentials.email,
          hasCaptcha: Boolean(credentials.captcha),
        });

        const adminEmail = process.env.ADMIN_EMAIL ?? '';
        const adminPassword = process.env.ADMIN_PASSWORD ?? '';
        const safeCompare = (a: string, b: string) =>
          a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

        const adminEmailMatch = adminEmail && safeCompare(credentials.email, adminEmail);
        const adminPasswordMatch =
          adminPassword && safeCompare(credentials.password, adminPassword);
        console.log('CRED_ADMIN_CHECK', {
          adminEmailMatch,
          adminPasswordMatch,
        });
        if (adminEmailMatch && adminPasswordMatch) {
          console.log('CRED_AUTH_SUCCESS', { kind: 'admin' });
          const adminUser: User = {
            id: 'admin',
            email: adminEmail,
            isAdmin: true,
            status: 'active',
          };
          return adminUser;
        }

        const captcha = credentials.captcha;
        if (!captcha) return null;
        const params = new URLSearchParams({
          secret: process.env.RECAPTCHA_SECRET ?? '',
          response: captcha,
        });
        const verify = await fetch(
          'https://www.google.com/recaptcha/api/siteverify',
          { method: 'POST', body: params },
        ).then((res) => res.json());
        console.log('CRED_RECAPTCHA', {
          success: Boolean(verify?.success),
          score: verify?.score ?? null,
          errorCodes: verify?.['error-codes'] ?? null,
        });
        if (!verify.success) return null;

        const userRecord = await prisma.user.findUnique({
          where: { email: credentials.email },
        });
        console.log('CRED_USER_LOOKUP', {
          found: Boolean(userRecord),
          emailVerified: Boolean(userRecord?.emailVerified),
          hasPassword: Boolean(userRecord?.hashedPassword),
        });
        if (!userRecord || !userRecord.emailVerified) return null;
        if (!userRecord.hashedPassword) return null;
        const valid = await compare(credentials.password, userRecord.hashedPassword);
        if (!valid) return null;
        console.log('CRED_AUTH_SUCCESS', { kind: 'user', id: userRecord.id });
        const dbUser: User = {
          id: userRecord.id.toString(),
          email: userRecord.email,
          isAdmin: userRecord.isAdmin,
          status: userRecord.status,
        };
        return dbUser;
      },
    }),
  ],
  session: { strategy: 'jwt' },
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === 'google') {
        const gateEnabled = isGateEnabled(process.env.GATE_ENABLED);
        if (gateEnabled) {
          const allowedEmails = parseAllowedEmails(process.env.GATE_ALLOWED_EMAILS);
          const rawEmail =
            user.email ??
            (typeof profile?.email === 'string' ? profile.email : undefined);
          const email = rawEmail?.trim().toLowerCase();
          if (!email || !allowedEmails.includes(email)) {
            const redirectUrl = buildAccessStatusUrl('gate', email ?? 'missing');
            return redirectUrl ?? false;
          }
        }
      }
      if (account?.provider === 'credentials') {
        return true;
      }
      const status = await resolveUserStatus(user);
      if (account?.provider && status !== 'active') {
        const redirectUrl = buildAccessStatusUrl(status);
        return redirectUrl ?? false;
      }
      return true;
    },
    async jwt({ token, user, account }) {
      console.log('JWT_CALLBACK_START', {
        hasUser: Boolean(user),
        provider: account?.provider ?? null,
        tokenId: token.id ?? null,
      });
      if (user) {
        token.id = user.id?.toString();
        token.isAdmin = user.isAdmin;
        token.userStatus = await resolveUserStatus(user);
        console.log('JWT_USER', {
          id: token.id,
          email: user.email,
          provider: account?.provider ?? null,
        });
      }
      if (account?.provider) {
        token.loginStage = account.provider;
        if (account.provider === 'google') {
          token.gatePassed = true;
          if (token.id && token.id !== 'admin') {
            token.id = 'gate';
          }
        }
        if (account.provider === 'credentials') {
          token.gatePassed = true;
        }
        console.log('JWT_ISSUED', {
          provider: account.provider,
          id: token.id,
          gatePassed: token.gatePassed ?? false,
          loginStage: token.loginStage,
        });
      }
      token.gatePassed = token.gatePassed ?? false;
      if (token.id && !user) {
        token.userStatus = await resolveUserStatusById(token.id);
      }
      return token;
    },
    async session({ session, token }) {
      console.log('SESSION_CALLBACK_START', {
        tokenId: token.id ?? null,
        loginStage: token.loginStage ?? null,
        gatePassed: token.gatePassed ?? null,
      });
      if (session.user && token.id) {
        session.user.id = token.id;
        session.user.isAdmin = token.isAdmin;
        session.user.status = token.userStatus;
      }
      session.loginStage = token.loginStage ?? 'credentials';
      session.gatePassed = token.gatePassed ?? false;
      console.log('SESSION_BUILT', {
        id: session.user?.id,
        loginStage: session.loginStage,
        gatePassed: session.gatePassed,
      });
      return session;
    },
  },
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
