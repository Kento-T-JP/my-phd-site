import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import GoogleLoginPanel from "@/components/GoogleLoginPanel";
import { authOptions } from "@/lib/authOptions";

export default async function LoginPage() {
  const session = (await getServerSession(authOptions)) as { user?: { id?: string; email?: string; isAdmin?: boolean; status?: string }; loginStage?: string; gatePassed?: boolean } | null;
  if (session?.loginStage === "credentials") {
    redirect("/home");
  }
  if (session?.loginStage === "google") {
    redirect("/login");
  }

  return <GoogleLoginPanel />;
}
