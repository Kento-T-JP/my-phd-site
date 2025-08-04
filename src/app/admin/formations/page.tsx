"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import BackButton from "@/components/BackButton";
import Spinner from "@/components/Spinner";

type Formation = {
  id: number;
  name: string;
  userEmail: string;
  createdAt: string;
};

export default function AdminFormationsPage() {
  const { data: session, status } = useSession();
  const [formations, setFormations] = useState<Formation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/formations");
      if (!res.ok) throw new Error();
      setFormations(await res.json());
    } catch (e) {
      setError("フォーメーションの取得に失敗しました");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (status === "authenticated") {
      load();
    }
  }, [status]);

  if (status === "loading") {
    return (
      <main className="p-8">
        <Spinner />
      </main>
    );
  }

  if (!session) {
    return (
      <main className="p-8">
        <p>
          Please <Link href="/login">login</Link> to view this page.
        </p>
      </main>
    );
  }

  if (!session.user?.isAdmin) {
    return (
      <main className="p-8">
        <p>Unauthorized</p>
      </main>
    );
  }

  return (
    <main className="p-8">
      <h1 className="text-xl font-bold mb-4">Formations</h1>
      {error && <p className="text-red-500 mb-4">{error}</p>}
      {isLoading ? (
        <Spinner />
      ) : (
        <table className="min-w-full border text-sm mb-4">
          <thead>
            <tr>
              <th className="border px-2 py-1">Name</th>
              <th className="border px-2 py-1">Owner</th>
              <th className="border px-2 py-1">Created</th>
            </tr>
          </thead>
          <tbody>
            {formations.map((f) => (
              <tr key={f.id}>
                <td className="border px-2 py-1">
                  <Link href={`/admin/formations/${f.id}`} className="underline">
                    {f.name}
                  </Link>
                </td>
                <td className="border px-2 py-1">{f.userEmail}</td>
                <td className="border px-2 py-1">
                  {new Date(f.createdAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <BackButton />
    </main>
  );
}

