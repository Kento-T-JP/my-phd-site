"use client";
import { useSession } from "next-auth/react";
import Link from "next/link";
import JfaImportForm from "@/components/JfaImportForm";
import BackButton from "@/components/BackButton";
import PageMain from "@/components/PageMain";

export default function JfaImportPage() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <PageMain className="p-4 sm:p-8 max-w-md mx-auto">
        <p>Loading...</p>
      </PageMain>
    );
  }

  if (!session) {
    return (
      <PageMain className="p-4 sm:p-8 max-w-md mx-auto">
        <p>
          Please <Link href="/login">login</Link> to view this page.
        </p>
      </PageMain>
    );
  }

  return (
    <PageMain className="p-4 sm:p-8 max-w-md mx-auto">
      <h1 className="text-xl font-bold mb-4">JFAメンバーインポート</h1>
      <JfaImportForm />
      <div className="mt-4">
        <BackButton />
      </div>
    </PageMain>
  );
}
