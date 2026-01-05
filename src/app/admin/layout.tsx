import { ReactNode } from "react";
import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import AdminNav from "@/components/AdminNav";

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isAdmin) {
    redirect("/login");
  }

  return (
    <div className="p-4">
      <AdminNav />
      {children}
    </div>
  );
}
