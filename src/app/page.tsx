import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import GoogleLoginPanel from "@/components/GoogleLoginPanel";
import { authOptions } from "@/pages/api/auth/[...nextauth]";

export default async function LoginPage() {
  const session = await getServerSession(authOptions);
  if (session) {
    redirect("/home");
  }

  return <GoogleLoginPanel />;
}
