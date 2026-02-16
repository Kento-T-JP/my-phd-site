"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import BackButton from "@/components/BackButton";
import Spinner from "@/components/Spinner";
import useClickSound from "@/lib/useClickSound";

type User = {
  id: number;
  email: string;
  emailVerified: string | null;
  isAdmin: boolean;
};

export default function UsersPage() {
  const { data: session, status } = useSession();
  const isAdmin = Boolean((session?.user as { isAdmin?: boolean } | undefined)?.isAdmin);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { play } = useClickSound();

  async function load() {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/users");
      if (!res.ok) throw new Error("Failed to fetch users");
      setUsers(await res.json());
    } catch {
      setError("ユーザーの取得に失敗しました");
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

  async function updateAdmin(id: number, isAdmin: boolean) {
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isAdmin }),
      });
      if (!res.ok) throw new Error();
      alert("更新しました");
      await load();
    } catch {
      alert("更新に失敗しました");
    }
  }

  async function deleteUser(id: number) {
    if (!confirm("削除してもよろしいですか？")) return;
    try {
      const res = await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || "削除に失敗しました");
      }
      alert("削除しました");
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "削除に失敗しました");
    }
  }

  return (
    <main className="space-y-4 p-1">
      <header>
        <h1 className="text-2xl font-bold text-cyan-50 sm:text-3xl">Users</h1>
        <p className="text-sm text-cyan-100/70">Manage admin privileges and user lifecycle.</p>
      </header>
      {error && <p className="rounded-lg border border-rose-300/40 bg-rose-500/15 px-3 py-2 text-sm text-rose-100">{error}</p>}
      {isLoading ? (
        <Spinner />
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {users.map((u) => (
              <article key={u.id} className="rounded-xl border border-cyan-300/25 bg-slate-900/45 p-3">
                <p className="break-all text-sm font-medium text-cyan-50">{u.email}</p>
                <p className="mt-1 text-xs text-cyan-100/70">
                  Verified: {u.emailVerified ? new Date(u.emailVerified).toLocaleDateString() : "-"}
                </p>
                <p className="mt-1 text-xs text-cyan-100/70">Admin: {u.isAdmin ? "Yes" : "No"}</p>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => {
                      play();
                      updateAdmin(u.id, !u.isAdmin);
                    }}
                    className="rounded-md border border-cyan-300/30 px-3 py-1.5 text-xs text-cyan-50"
                  >
                    {u.isAdmin ? "Demote" : "Promote"}
                  </button>
                  <button
                    onClick={() => {
                      play();
                      deleteUser(u.id);
                    }}
                    className="rounded-md border border-rose-300/40 px-3 py-1.5 text-xs text-rose-200"
                  >
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
          <div className="hidden overflow-x-auto rounded-xl border border-cyan-300/20 md:block">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-900/70 text-cyan-100/80">
                <tr>
                  <th className="px-3 py-2 text-left">Email</th>
                  <th className="px-3 py-2 text-left">Verified</th>
                  <th className="px-3 py-2 text-left">Admin</th>
                  <th className="px-3 py-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cyan-300/15 bg-slate-900/45">
                {users.map((u) => (
                  <tr key={u.id}>
                    <td className="px-3 py-2 break-all">{u.email}</td>
                    <td className="px-3 py-2">
                      {u.emailVerified ? new Date(u.emailVerified).toLocaleDateString() : "-"}
                    </td>
                    <td className="px-3 py-2">{u.isAdmin ? "Yes" : "No"}</td>
                    <td className="px-3 py-2">
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            play();
                            updateAdmin(u.id, !u.isAdmin);
                          }}
                          className="rounded-md border border-cyan-300/30 px-2 py-1 text-xs text-cyan-50"
                        >
                          {u.isAdmin ? "Demote" : "Promote"}
                        </button>
                        <button
                          onClick={() => {
                            play();
                            deleteUser(u.id);
                          }}
                          className="rounded-md border border-rose-300/40 px-2 py-1 text-xs text-rose-200"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      <div className="pt-1">
        <BackButton />
      </div>
    </main>
  );
}
