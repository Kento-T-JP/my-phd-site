"use client";
import { useSession } from "next-auth/react";
import Link from "next/link";
import JfaImportForm from "@/components/JfaImportForm";
import BackButton from "@/components/BackButton";

export default function JfaImportPage() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <main className="p-8 max-w-md mx-auto">
        <p>Loading...</p>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="p-8 max-w-md mx-auto">
        <p>
          Please <Link href="/login">login</Link> to view this page.
        </p>
      </main>
    );
  }

  return (
    <main className="p-8 max-w-md mx-auto">
      <h1 className="text-xl font-bold mb-4">JFAメンバーインポート</h1>
      <JfaImportForm />
      <div className="mt-4">
        <BackButton />
      </div>
    </main>
  );
}
