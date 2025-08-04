"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import BackButton from "@/components/BackButton";
import Spinner from "@/components/Spinner";

interface Inquiry {
  id: string;
  name: string;
  email: string;
  message: string;
  status: string;
  createdAt: string;
}

export default function AdminInquiriesPage() {
  const { data: session, status } = useSession();
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/inquiries");
      if (!res.ok) throw new Error();
      setInquiries((await res.json()) as Inquiry[]);
    } catch (e) {
      setError("問い合わせの取得に失敗しました");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (status === "authenticated") {
      load();
    }
  }, [status]);

  const markHandled = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/inquiries/${id}`, { method: "PATCH" });
      if (!res.ok) throw new Error();
      alert("更新しました");
      await load();
    } catch (e) {
      alert("更新に失敗しました");
    }
  };

  const removeInquiry = async (id: string) => {
    if (!confirm("削除してもよろしいですか？")) return;
    try {
      const res = await fetch(`/api/admin/inquiries/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      alert("削除しました");
      await load();
    } catch (e) {
      alert("削除に失敗しました");
    }
  };

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
      <h1 className="text-xl font-bold mb-4">Inquiries</h1>
      {error && <p className="text-red-500 mb-4">{error}</p>}
      {isLoading ? (
        <Spinner />
      ) : (
        <table className="min-w-full border text-sm">
          <thead>
            <tr>
              <th className="border px-2 py-1">Name</th>
              <th className="border px-2 py-1">Email</th>
              <th className="border px-2 py-1">Message</th>
              <th className="border px-2 py-1">Timestamp</th>
              <th className="border px-2 py-1">Status</th>
              <th className="border px-2 py-1">Actions</th>
            </tr>
          </thead>
          <tbody>
            {inquiries.map((q) => (
              <tr key={q.id}>
                <td className="border px-2 py-1">{q.name}</td>
                <td className="border px-2 py-1">{q.email}</td>
                <td className="border px-2 py-1 max-w-xs truncate">{q.message}</td>
                <td className="border px-2 py-1">
                  {new Date(q.createdAt).toLocaleString()}
                </td>
                <td className="border px-2 py-1">{q.status}</td>
                <td className="border px-2 py-1 space-x-2">
                  {q.status !== "handled" && (
                    <button
                      className="bg-blue-500 text-white px-2 py-1 rounded"
                      onClick={() => markHandled(q.id)}
                    >
                      Mark handled
                    </button>
                  )}
                  <button
                    className="bg-red-500 text-white px-2 py-1 rounded"
                    onClick={() => removeInquiry(q.id)}
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

