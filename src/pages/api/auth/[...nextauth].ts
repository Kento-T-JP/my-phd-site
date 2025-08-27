import NextAuth, { type NextAuthOptions, type Session, type User } from "next-auth";
import { type JWT } from "next-auth/jwt";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import prisma from "@/lib/db";
import { compare } from "bcrypt";
import { timingSafeEqual } from "crypto";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials): Promise<User | null> {
        if (!credentials?.email || !credentials.password) return null;

        if (process.env.RECAPTCHA_SECRET_KEY) {
          const token = credentials.recaptchaToken as string | undefined;
          if (!token) {
            throw new Error("reCAPTCHA token missing");
          }
          const params = new URLSearchParams({
            secret: process.env.RECAPTCHA_SECRET_KEY,
            response: token,
          });
          try {
            const resp = await fetch(
              "https://www.google.com/recaptcha/api/siteverify",
              {
                method: "POST",
                body: params,
              },
            );
            const data = await resp.json();
            if (!data.success) {
              throw new Error("reCAPTCHA verification failed");
            }
          } catch {
            throw new Error("reCAPTCHA verification failed");
          }
        }

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
    async jwt({ token, user }: { token: JWT & { id?: string; isAdmin?: boolean }; user?: User }) {
      if (user) {
        token.id = user.id;
        token.isAdmin = user.isAdmin;
      }
      return token;
    },
    async session({ session, token }: { session: Session; token: JWT & { id?: string; isAdmin?: boolean } }) {
      if (session.user) {
        session.user.id = token.id!;
        session.user.isAdmin = token.isAdmin;
      }
      return session;
    },
  },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
export default handler;

