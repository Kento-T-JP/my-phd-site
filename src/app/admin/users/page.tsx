"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import BackButton from "@/components/BackButton";

type User = {
  id: number;
  email: string;
  emailVerified: string | null;
  isAdmin: boolean;
};

export default function UsersPage() {
  const { data: session, status } = useSession();
  const [users, setUsers] = useState<User[]>([]);

  async function load() {
    const res = await fetch("/api/admin/users");
    if (res.ok) {
      setUsers(await res.json());
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
        <p>Loading...</p>
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

  async function updateAdmin(id: number, isAdmin: boolean) {
    await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isAdmin }),
    });
    await load();
  }

  async function deleteUser(id: number) {
    await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
    await load();
  }

  return (
    <main className="p-8">
      <h1 className="text-xl font-bold mb-4">ユーザー一覧</h1>
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
                  onClick={() => updateAdmin(u.id, !u.isAdmin)}
                  className="underline text-blue-600"
                >
                  {u.isAdmin ? "Demote" : "Promote"}
                </button>
                <button
                  onClick={() => deleteUser(u.id)}
                  className="underline text-red-600"
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-4">
        <BackButton />
      </div>
    </main>
  );
}

