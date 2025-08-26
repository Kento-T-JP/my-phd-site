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
        captcha: { label: "Captcha", type: "text" },
      },
      async authorize(credentials): Promise<User | null> {
        if (!credentials?.email || !credentials.password) return null;

        const secret = process.env.RECAPTCHA_SECRET;
        if (secret) {
          if (!credentials.captcha) return null;
          try {
            const params = new URLSearchParams();
            params.append("secret", secret);
            params.append("response", credentials.captcha);
            const verifyRes = await fetch(
              "https://www.google.com/recaptcha/api/siteverify",
              {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: params,
              }
            );
            const verifyData = await verifyRes.json();
            if (!verifyData.success) {
              throw new Error("InvalidCaptcha");
            }
          } catch {
            throw new Error("InvalidCaptcha");
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

