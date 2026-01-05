import NextAuth, { type NextAuthOptions, type User } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import { compare } from 'bcrypt';
import { timingSafeEqual } from 'crypto';

import prisma from '@/lib/prisma';

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
        };
        return dbUser;
      },
    }),
  ],
  session: { strategy: 'jwt' },
  callbacks: {
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id?.toString();
        token.isAdmin = user.isAdmin;
      }
      if (account?.provider) {
        token.loginStage = account.provider;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id;
        session.user.isAdmin = token.isAdmin;
      }
      session.loginStage = token.loginStage ?? 'credentials';
      return session;
    },
  },
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
