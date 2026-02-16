"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import BackButton from "@/components/BackButton";
import Spinner from "@/components/Spinner";
import MessageCell from "@/components/MessageCell";
import useClickSound from "@/lib/useClickSound";

interface Inquiry {
  id: string;
  name: string;
  email: string;
  category: string | null;
  message: string;
  status: string;
  createdAt: string;
}

export default function AdminInquiriesPage() {
  const { data: session, status } = useSession();
  const isAdmin = Boolean((session?.user as { isAdmin?: boolean } | undefined)?.isAdmin);
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { play } = useClickSound();

  async function load() {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/inquiries");
      if (!res.ok) throw new Error();
      setInquiries((await res.json()) as Inquiry[]);
    } catch {
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

  const toggleHandled = async (id: string, status: string) => {
    const nextStatus = status === "handled" ? "received" : "handled";
    try {
      const res = await fetch(`/api/admin/inquiries/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) throw new Error();
      alert("更新しました");
      await load();
    } catch {
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
    } catch {
      alert("削除に失敗しました");
    }
  };

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
        <h1 className="text-2xl font-bold text-cyan-50 sm:text-3xl">Inquiries</h1>
        <p className="text-sm text-cyan-100/70">Track incoming support messages and response status.</p>
      </header>
      {error && <p className="rounded-lg border border-rose-300/40 bg-rose-500/15 px-3 py-2 text-sm text-rose-100">{error}</p>}
      {isLoading ? (
        <Spinner />
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {inquiries.map((q) => (
              <article key={q.id} className="rounded-xl border border-cyan-300/25 bg-slate-900/45 p-3">
                <p className="text-xs text-cyan-100/60">{q.id}</p>
                <p className="mt-1 text-sm font-semibold text-cyan-50">{q.name}</p>
                <p className="text-xs text-cyan-100/70">{q.email}</p>
                <p className="mt-1 text-xs text-cyan-100/70">Category: {q.category ?? "-"}</p>
                <p className="mt-1 text-xs text-cyan-100/70">Status: {q.status === "handled" ? "Handled" : "Unhandled"}</p>
                <p className="mt-1 text-xs text-cyan-100/70">{new Date(q.createdAt).toLocaleString()}</p>
                <div className="mt-2 rounded-md border border-cyan-300/20 bg-slate-950/30 p-2">
                  <MessageCell message={q.message} className="max-w-none" />
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    className="rounded-md border border-cyan-300/30 px-3 py-1.5 text-xs text-cyan-50"
                    onClick={() => {
                      play();
                      toggleHandled(q.id, q.status);
                    }}
                  >
                    {q.status === "handled" ? "Unmark handled" : "Mark handled"}
                  </button>
                  <button
                    className="rounded-md border border-rose-300/40 px-3 py-1.5 text-xs text-rose-200"
                    onClick={() => {
                      play();
                      removeInquiry(q.id);
                    }}
                  >
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
          <div className="hidden overflow-x-auto rounded-xl border border-cyan-300/20 md:block">
            <table className="min-w-[980px] text-sm">
              <thead className="bg-slate-900/70 text-cyan-100/80">
                <tr>
                  <th className="px-3 py-2 text-left">ID</th>
                  <th className="px-3 py-2 text-left">Name</th>
                  <th className="px-3 py-2 text-left">Email</th>
                  <th className="px-3 py-2 text-left">Category</th>
                  <th className="px-3 py-2 text-left">Message</th>
                  <th className="px-3 py-2 text-left">Timestamp</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cyan-300/15 bg-slate-900/45">
                {inquiries.map((q) => (
                  <tr key={q.id}>
                    <td className="px-3 py-2">{q.id}</td>
                    <td className="px-3 py-2">{q.name}</td>
                    <td className="px-3 py-2">{q.email}</td>
                    <td className="px-3 py-2">{q.category ?? "-"}</td>
                    <td className="px-3 py-2">
                      <MessageCell message={q.message} className="max-w-xs" />
                    </td>
                    <td className="px-3 py-2">{new Date(q.createdAt).toLocaleString()}</td>
                    <td className="px-3 py-2">{q.status === "handled" ? "Handled" : "Unhandled"}</td>
                    <td className="px-3 py-2">
                      <div className="flex gap-2">
                        <button
                          className="rounded-md border border-cyan-300/30 px-2 py-1 text-xs text-cyan-50"
                          onClick={() => {
                            play();
                            toggleHandled(q.id, q.status);
                          }}
                        >
                          {q.status === "handled" ? "Unmark handled" : "Mark handled"}
                        </button>
                        <button
                          className="rounded-md border border-rose-300/40 px-2 py-1 text-xs text-rose-200"
                          onClick={() => {
                            play();
                            removeInquiry(q.id);
                          }}
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
      <div className="mt-4">
        <BackButton />
      </div>
    </main>
  );
}
