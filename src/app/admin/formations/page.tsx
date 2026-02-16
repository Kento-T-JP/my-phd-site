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
  const isAdmin = Boolean((session?.user as { isAdmin?: boolean } | undefined)?.isAdmin);
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
    } catch {
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
      <main className="p-1">
        <Spinner />
      </main>
    );
  }

  if (!session) {
    return (
      <main className="p-1">
        <p>
          Please <Link href="/login">login</Link> to view this page.
        </p>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="p-1">
        <p>Unauthorized</p>
      </main>
    );
  }

  return (
    <main className="space-y-4 p-1">
      <header>
        <h1 className="text-2xl font-bold text-cyan-50 sm:text-3xl">Formations</h1>
        <p className="text-sm text-cyan-100/70">Browse saved formations across all users.</p>
      </header>
      {error && <p className="rounded-lg border border-rose-300/40 bg-rose-500/15 px-3 py-2 text-sm text-rose-100">{error}</p>}
      {isLoading ? (
        <Spinner />
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {formations.map((f) => (
              <article key={f.id} className="rounded-xl border border-cyan-300/25 bg-slate-900/45 p-3">
                <Link href={`/admin/formations/${f.id}`} className="text-sm font-semibold text-cyan-100 underline underline-offset-2">
                  {f.name}
                </Link>
                <p className="mt-1 text-xs text-cyan-100/70">{f.userEmail}</p>
                <p className="mt-1 text-xs text-cyan-100/70">
                  {new Date(f.createdAt).toLocaleDateString()}
                </p>
              </article>
            ))}
          </div>
          <div className="hidden overflow-x-auto rounded-xl border border-cyan-300/20 md:block">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-900/70 text-cyan-100/80">
                <tr>
                  <th className="px-3 py-2 text-left">Name</th>
                  <th className="px-3 py-2 text-left">Owner</th>
                  <th className="px-3 py-2 text-left">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cyan-300/15 bg-slate-900/45">
                {formations.map((f) => (
                  <tr key={f.id}>
                    <td className="px-3 py-2">
                      <Link href={`/admin/formations/${f.id}`} className="underline underline-offset-2">
                        {f.name}
                      </Link>
                    </td>
                    <td className="px-3 py-2">{f.userEmail}</td>
                    <td className="px-3 py-2">{new Date(f.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      <BackButton />
    </main>
  );
}
