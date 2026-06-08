import { type NextAuthOptions, type User } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import { compare } from 'bcrypt';
import { timingSafeEqual } from 'crypto';

import prisma from '@/lib/prisma';

const isAuthDebug =
  process.env.NODE_ENV !== 'production' || process.env.NEXTAUTH_DEBUG === 'true';
const parsedUserStatusRevalidateMs = Number(process.env.USER_STATUS_REVALIDATE_MS);
const USER_STATUS_REVALIDATE_MS =
  Number.isFinite(parsedUserStatusRevalidateMs) && parsedUserStatusRevalidateMs >= 0
    ? parsedUserStatusRevalidateMs
    : 5 * 60 * 1000;

const authLog = (...args: unknown[]) => {
  if (isAuthDebug) {
    console.log(...args);
  }
};

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

const isFeatureEnabled = (value: string | undefined, defaultValue: boolean): boolean => {
  if (!value) return defaultValue;
  const normalized = value.trim().toLowerCase();
  if (['false', '0', 'off', 'no', 'disabled'].includes(normalized)) return false;
  if (['true', '1', 'on', 'yes', 'enabled'].includes(normalized)) return true;
  return defaultValue;
};

export const isGoogleAuthEnabled = isFeatureEnabled(
  process.env.GOOGLE_AUTH_ENABLED,
  false,
);

const isValidIntId = (value: number): boolean =>
  Number.isSafeInteger(value) && value > 0 && value <= 2147483647;

const resolveOrCreateAdminUser = async (email: string) => {
  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true, isAdmin: true, status: true },
  });
  if (existing) {
    if (!existing.isAdmin || existing.status !== 'active') {
      const updated = await prisma.user.update({
        where: { id: existing.id },
        data: { isAdmin: true, status: 'active', emailVerified: new Date() },
        select: { id: true, isAdmin: true, status: true },
      });
      return updated;
    }
    return existing;
  }
  return prisma.user.create({
    data: {
      email,
      hashedPassword: '!admin-env-login!',
      isAdmin: true,
      status: 'active',
      emailVerified: new Date(),
    },
    select: { id: true, isAdmin: true, status: true },
  });
};

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
  debug: isAuthDebug,
  logger: {
    error(code, metadata) {
      console.error('NEXTAUTH_ERROR', code, metadata);
    },
    warn(code) {
      if (isAuthDebug) {
        console.warn('NEXTAUTH_WARN', code);
      }
    },
    debug(code, metadata) {
      authLog('NEXTAUTH_DEBUG', code, metadata);
    },
  },
  providers: [
    ...(isGoogleAuthEnabled
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID ?? '',
            clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
            authorization: {
              params: {
                prompt: 'select_account',
              },
            },
          }),
        ]
      : []),
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'text' },
        password: { label: 'Password', type: 'password' },
        captcha: { label: 'Captcha', type: 'text' },
      },
      async authorize(credentials): Promise<User | null> {
        if (!credentials?.email || !credentials.password) return null;
        const normalizedEmail = credentials.email.trim().toLowerCase();

        authLog('CRED_START', {
          email: normalizedEmail,
          hasCaptcha: Boolean(credentials.captcha),
        });

        const adminEmail = (process.env.ADMIN_EMAIL ?? '').trim().toLowerCase();
        const adminPassword = process.env.ADMIN_PASSWORD ?? '';
        const safeCompare = (a: string, b: string) =>
          a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

        const adminEmailMatch = adminEmail && safeCompare(normalizedEmail, adminEmail);
        const adminPasswordMatch =
          adminPassword && safeCompare(credentials.password, adminPassword);
        authLog('CRED_ADMIN_CHECK', {
          adminEmailMatch,
          adminPasswordMatch,
        });
        if (adminEmailMatch && adminPasswordMatch) {
          let adminId = 'admin';
          try {
            const adminRecord = await resolveOrCreateAdminUser(normalizedEmail);
            adminId = String(adminRecord.id);
          } catch (error) {
            authLog('CRED_ADMIN_USER_RESOLVE_FAILED', { error });
          }
          authLog('CRED_AUTH_SUCCESS', { kind: 'admin' });
          const adminUser: User = {
            id: adminId,
            email: normalizedEmail,
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
        authLog('CRED_RECAPTCHA', {
          success: Boolean(verify?.success),
          score: verify?.score ?? null,
          errorCodes: verify?.['error-codes'] ?? null,
        });
        if (!verify.success) return null;

        const userRecord = await prisma.user.findUnique({
          where: { email: normalizedEmail },
        });
        authLog('CRED_USER_LOOKUP', {
          found: Boolean(userRecord),
          emailVerified: Boolean(userRecord?.emailVerified),
          hasPassword: Boolean(userRecord?.hashedPassword),
        });
        if (!userRecord) return null;
        if (!userRecord.hashedPassword) return null;
        const valid = await compare(credentials.password, userRecord.hashedPassword);
        if (!valid) return null;
        if (!userRecord.isAdmin && !userRecord.emailVerified) return null;
        authLog('CRED_AUTH_SUCCESS', { kind: 'user', id: userRecord.id });
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
      authLog('JWT_CALLBACK_START', {
        hasUser: Boolean(user),
        provider: account?.provider ?? null,
        tokenId: token.id ?? null,
      });
      if (user) {
        token.id = user.id?.toString();
        token.isAdmin = user.isAdmin;
        token.userStatus = await resolveUserStatus(user);
        token.userStatusCheckedAt = Date.now();
        authLog('JWT_USER', {
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
        authLog('JWT_ISSUED', {
          provider: account.provider,
          id: token.id,
          gatePassed: token.gatePassed ?? false,
          loginStage: token.loginStage,
        });
      }
      token.gatePassed = token.gatePassed ?? false;
      if (token.id && !user) {
        const now = Date.now();
        const lastCheckedAt =
          typeof token.userStatusCheckedAt === 'number' ? token.userStatusCheckedAt : 0;
        const shouldRefreshStatus =
          !token.userStatus || now - lastCheckedAt >= USER_STATUS_REVALIDATE_MS;
        if (shouldRefreshStatus) {
          token.userStatus = await resolveUserStatusById(token.id);
          token.userStatusCheckedAt = now;
        }
      }
      return token;
    },
    async session({ session, token }) {
      authLog('SESSION_CALLBACK_START', {
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
      authLog('SESSION_BUILT', {
        id: session.user?.id,
        loginStage: session.loginStage,
        gatePassed: session.gatePassed,
      });
      return session;
    },
  },
};
