import { DefaultSession, DefaultUser } from "next-auth";

declare module "next-auth" {
  interface Session {
    user?: {
      id: string;
      isAdmin?: boolean;
    } & DefaultSession["user"];
    loginStage?: string;
  }

  interface User extends DefaultUser {
    id: string;
    isAdmin?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    isAdmin?: boolean;
    loginStage?: string;
  }
}
