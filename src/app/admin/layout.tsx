import { ReactNode } from "react";
import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/authOptions";
import AdminNav from "@/components/AdminNav";

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = (await getServerSession(authOptions)) as
    | { user?: { isAdmin?: boolean } }
    | null;
  const isAdmin = Boolean(session?.user?.isAdmin);
  if (!isAdmin) {
    redirect("/login");
  }

  return (
    <div className="p-4">
      <AdminNav />
      {children}
    </div>
  );
}
