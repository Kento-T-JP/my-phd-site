import NextAuth, { type NextAuthOptions, type Session, type User } from "next-auth";
import { type JWT } from "next-auth/jwt";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import prisma from "@/lib/db";
import { compare } from "bcrypt";
import { randomUUID, timingSafeEqual } from "crypto";

const allowedGoogleEmail = "japan.start11@gmail.com";

const prismaAdapter = PrismaAdapter(prisma);
const adapter = {
  ...prismaAdapter,
  async createUser(user) {
    return prisma.user.create({
      data: {
        ...user,
        hashedPassword: randomUUID(),
        emailVerified: user.emailVerified ?? new Date(),
      },
    });
  },
};

export const authOptions: NextAuthOptions = {
  adapter,
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" },
        captcha: { label: "Captcha", type: "text" },
      },
      async authorize(credentials): Promise<User | null> {
        if (!credentials?.email || !credentials.password) return null;

        const captcha = credentials?.captcha;
        if (!captcha) return null;
        const params = new URLSearchParams({
          secret: process.env.RECAPTCHA_SECRET!,
          response: captcha,
        });
        const verify = await fetch(
          "https://www.google.com/recaptcha/api/siteverify",
          { method: "POST", body: params }
        ).then((res) => res.json());
        if (!verify.success) return null;

        const adminEmail = process.env.ADMIN_EMAIL || "";
        const adminPassword = process.env.ADMIN_PASSWORD || "";
        const safeCompare = (a: string, b: string) =>
          a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

        if (
          adminEmail &&
          adminPassword &&
          safeCompare(credentials.email, adminEmail) &&
          safeCompare(credentials.password, adminPassword)
        ) {
          const adminUser: User = {
            id: "admin",
            email: adminEmail,
            isAdmin: true,
          };
          return adminUser;
        }

        const userRecord = await prisma.user.findUnique({
          where: { email: credentials.email },
        });
        if (!userRecord) return null;
        if (!userRecord.emailVerified) return null;
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
  session: { strategy: "jwt" },
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "google") {
        return user.email?.toLowerCase() === allowedGoogleEmail.toLowerCase();
      }
      return true;
    },
    async jwt({ token, user }: { token: JWT & { id?: string; isAdmin?: boolean }; user?: User }) {
      if (user) {
        token.id = user.id;
        token.isAdmin = user.isAdmin;
      }
      if (account?.provider) {
        token.loginStage = account.provider;
      }
      return token;
    },
    async session({
      session,
      token,
    }: {
      session: Session;
      token: JWT & { id?: string; isAdmin?: boolean; loginStage?: string };
    }) {
      if (session.user) {
        session.user.id = token.id!;
        session.user.isAdmin = token.isAdmin;
      }
      session.loginStage = token.loginStage ?? "credentials";
      return session;
    },
  },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
export default handler;
