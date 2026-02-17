import { ReactNode } from "react";
import type { Metadata } from "next";
import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/authOptions";
import AdminNav from "@/components/AdminNav";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

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
    <div className="px-3 py-4 sm:px-5 sm:py-6">
      <div className="mx-auto w-full max-w-7xl space-y-4 sm:space-y-6">
        <AdminNav />
        <div className="glass-panel p-3 sm:p-5">{children}</div>
      </div>
    </div>
  );
}
