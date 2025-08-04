"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import BackButton from "@/components/BackButton";

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

  useEffect(() => {
    if (status !== "authenticated") return;
    async function load() {
      const res = await fetch("/api/admin/inquiries");
      if (res.ok) {
        setInquiries((await res.json()) as Inquiry[]);
      }
    }
    load();
  }, [status]);

  const markHandled = async (id: string) => {
    const res = await fetch(`/api/admin/inquiries/${id}`, { method: "PATCH" });
    if (res.ok) {
      const updated = (await res.json()) as Inquiry;
      setInquiries((prev) => prev.map((q) => (q.id === id ? updated : q)));
    }
  };

  const removeInquiry = async (id: string) => {
    const res = await fetch(`/api/admin/inquiries/${id}`, { method: "DELETE" });
    if (res.ok) {
      setInquiries((prev) => prev.filter((q) => q.id !== id));
    }
  };

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

  return (
    <main className="p-8">
      <h1 className="text-xl font-bold mb-4">Inquiries</h1>
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
      <div className="mt-4">
        <BackButton />
      </div>
    </main>
  );
}

