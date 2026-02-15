import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import GoogleLoginPanel from "@/components/GoogleLoginPanel";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export default async function LoginPage() {
  const session = await getServerSession(authOptions);
  if (session?.loginStage === "credentials") {
    redirect("/home");
  }
  if (session?.loginStage === "google") {
    redirect("/login");
  }

  return <GoogleLoginPanel />;
}
