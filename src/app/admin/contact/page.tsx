"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import BackButton from "@/components/BackButton";
import Spinner from "@/components/Spinner";

type ContactSubmission = {
  id: string;
  name: string;
  email: string;
  category: string | null;
  message: string;
  status: string;
  createdAt: string;
};

export default function ContactSubmissionsPage() {
  const { data: session, status } = useSession();
  const [submissions, setSubmissions] = useState<ContactSubmission[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/contact-submissions");
      if (!res.ok) throw new Error();
      setSubmissions((await res.json()) as ContactSubmission[]);
    } catch (e) {
      setError("お問い合わせの取得に失敗しました");
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
      <h1 className="text-xl font-bold mb-4">お問い合わせ一覧</h1>
      {error && <p className="text-red-500 mb-4">{error}</p>}
      {isLoading ? (
        <Spinner />
      ) : (
        <table className="min-w-full border text-sm">
          <thead>
            <tr>
              <th className="border px-2 py-1">ID</th>
              <th className="border px-2 py-1">名前</th>
              <th className="border px-2 py-1">メール</th>
              <th className="border px-2 py-1">カテゴリ</th>
              <th className="border px-2 py-1">メッセージ</th>
              <th className="border px-2 py-1">投稿日時</th>
              <th className="border px-2 py-1">ステータス</th>
            </tr>
          </thead>
          <tbody>
            {submissions.map((s) => (
              <tr key={s.id}>
                <td className="border px-2 py-1">{s.id}</td>
                <td className="border px-2 py-1">{s.name}</td>
                <td className="border px-2 py-1">{s.email}</td>
                <td className="border px-2 py-1">{s.category ?? ""}</td>
                <td className="border px-2 py-1 max-w-xs truncate">
                  {s.message}
                </td>
                <td className="border px-2 py-1">
                  {new Date(s.createdAt).toLocaleString()}
                </td>
                <td className="border px-2 py-1">{s.status}</td>
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
