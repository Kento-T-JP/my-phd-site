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

const resolveUserStatus = async (user: User): Promise<string> => {
  if (user.id === 'admin') {
    return 'active';
  }
  const numericId = Number(user.id);
  const record = Number.isNaN(numericId)
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
  if (id === 'admin') {
    return 'active';
  }
  const numericId = Number(id);
  if (Number.isNaN(numericId)) {
    return 'pending';
  }
  const record = await prisma.user.findUnique({
    where: { id: numericId },
    select: { status: true },
  });
  return record?.status ?? 'pending';
};

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    }),
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'text' },
        password: { label: 'Password', type: 'password' },
        captcha: { label: 'Captcha', type: 'text' },
      },
      async authorize(credentials): Promise<User | null> {
        if (!credentials?.email || !credentials.password) return null;

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
        if (!verify.success) return null;

        const adminEmail = process.env.ADMIN_EMAIL ?? '';
        const adminPassword = process.env.ADMIN_PASSWORD ?? '';
        const safeCompare = (a: string, b: string) =>
          a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

        if (
          adminEmail &&
          adminPassword &&
          safeCompare(credentials.email, adminEmail) &&
          safeCompare(credentials.password, adminPassword)
        ) {
          const adminUser: User = {
            id: 'admin',
            email: adminEmail,
            isAdmin: true,
            status: 'active',
          };
          return adminUser;
        }

        const userRecord = await prisma.user.findUnique({
          where: { email: credentials.email },
        });
        if (!userRecord || !userRecord.emailVerified) return null;
        if (!userRecord.hashedPassword) return null;
        const valid = await compare(credentials.password, userRecord.hashedPassword);
        if (!valid) return null;
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
    async signIn({ user, account }) {
      if (account?.provider === 'google') {
        const numericId = Number(user.id);
        const gateEnabled = isGateEnabled(process.env.GATE_ENABLED);
        if (gateEnabled) {
          const allowedEmails = parseAllowedEmails(process.env.GATE_ALLOWED_EMAILS);
          const email = user.email?.trim().toLowerCase();
          if (!email || !allowedEmails.includes(email)) {
            return false;
          }
        }
        if (!Number.isNaN(numericId)) {
          await prisma.user.update({
            where: { id: numericId },
            data: { status: 'active' },
          });
          user.status = 'active';
        }
      }
      const status = await resolveUserStatus(user);
      if (account?.provider && status !== 'active') {
        return `/access-status?status=${encodeURIComponent(status)}`;
      }
      return true;
    },
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id?.toString();
        token.isAdmin = user.isAdmin;
        token.userStatus = await resolveUserStatus(user);
      }
      if (account?.provider) {
        token.loginStage = account.provider;
      }
      if (token.id && !user) {
        token.userStatus = await resolveUserStatusById(token.id);
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id;
        session.user.isAdmin = token.isAdmin;
        session.user.status = token.userStatus;
      }
      session.loginStage = token.loginStage ?? 'credentials';
      return session;
    },
  },
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
