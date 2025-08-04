import NextAuth, { type NextAuthOptions } from "next-auth";
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
      async authorize(credentials) {
        if (!credentials?.email || !credentials.password) return null;

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
          return {
            id: "admin",
            email: adminEmail,
            isAdmin: true,
          } as any;
        }

      const user = await prisma.user.findUnique({
        where: { email: credentials.email },
      });
      if (!user) return null;
      if (!user.emailVerified) return null;
      const valid = await compare(credentials.password, user.hashedPassword);
      if (!valid) return null;
      return {
        id: user.id.toString(),
        email: user.email,
          isAdmin: user.isAdmin,
        } as any;
      },
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.isAdmin = (user as any).isAdmin;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).isAdmin = token.isAdmin as boolean;
      }
      return session;
    },
  },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
export default handler;

