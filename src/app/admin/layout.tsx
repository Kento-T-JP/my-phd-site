import { ReactNode } from "react";
import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { authOptions } from "@/pages/api/auth/[...nextauth]";

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
      <nav className="mb-4 space-x-4">
        <Link href="/admin/users">Users</Link>
        <Link href="/admin/inquiries">Inquiries</Link>
        <Link href="/admin/formations">Formations</Link>
        <Link href="/admin/stats">Stats</Link>
      </nav>
      {children}
    </div>
  );
}
