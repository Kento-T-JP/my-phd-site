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
      <main className="p-4 sm:p-8">
        <Spinner />
      </main>
    );
  }

  if (!session) {
    return (
      <main className="p-4 sm:p-8">
        <p>
          Please <Link href="/login">login</Link> to view this page.
        </p>
      </main>
    );
  }

  if (!session.user?.isAdmin) {
    return (
      <main className="p-4 sm:p-8">
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
      if (!res.ok) throw new Error();
      alert("削除しました");
      await load();
    } catch {
      alert("削除に失敗しました");
    }
  }

  return (
    <main className="p-4 sm:p-8">
      <h1 className="text-xl font-bold mb-4">ユーザー一覧</h1>
      {error && <p className="text-red-500 mb-4">{error}</p>}
      {isLoading ? (
        <Spinner />
      ) : (
        <table className="min-w-full border text-sm">
          <thead>
            <tr>
              <th className="border px-2 py-1">Email</th>
              <th className="border px-2 py-1">Verified</th>
              <th className="border px-2 py-1">Admin</th>
              <th className="border px-2 py-1">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td className="border px-2 py-1">{u.email}</td>
                <td className="border px-2 py-1">
                  {u.emailVerified ? new Date(u.emailVerified).toLocaleDateString() : ""}
                </td>
                <td className="border px-2 py-1">{u.isAdmin ? "Yes" : "No"}</td>
                <td className="border px-2 py-1 space-x-2">
                  <button
                    onClick={() => {
                      play();
                      updateAdmin(u.id, !u.isAdmin);
                    }}
                    className="underline text-blue-600"
                  >
                    {u.isAdmin ? "Demote" : "Promote"}
                  </button>
                  <button
                    onClick={() => {
                      play();
                      deleteUser(u.id);
                    }}
                    className="underline text-red-600"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="mt-4">
        <BackButton />
      </div>
    </main>
  );
}

