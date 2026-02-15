import { DefaultSession, DefaultUser } from "next-auth";

declare module "next-auth" {
  interface Session {
    user?: {
      id: string;
      isAdmin?: boolean;
      status?: string;
    } & DefaultSession["user"];
    loginStage?: string;
    gatePassed?: boolean;
  }

  interface User extends DefaultUser {
    id: string;
    isAdmin?: boolean;
    status?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    isAdmin?: boolean;
    loginStage?: string;
    userStatus?: string;
    gatePassed?: boolean;
  }
}
