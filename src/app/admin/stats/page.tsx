"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import BackButton from "@/components/BackButton";
import Spinner from "@/components/Spinner";

type Stats = {
  totalUsers: number;
  verifiedUsers: number;
  totalFormations: number;
  totalContactInquiries: number;
  registrationsLast7Days: number;
  pageViews: number;
  siteVisitors: number;
};

export default function StatsPage() {
  const { data: session, status } = useSession();
  const isAdmin = Boolean((session?.user as { isAdmin?: boolean } | undefined)?.isAdmin);
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/stats");
      if (!res.ok) throw new Error();
      setStats(await res.json());
    } catch {
      setError("統計情報の取得に失敗しました");
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
        <h1 className="text-2xl font-bold text-cyan-50 sm:text-3xl">Stats</h1>
        <p className="text-sm text-cyan-100/70">Overview of users, traffic and content status.</p>
      </header>
      {error && <p className="rounded-lg border border-rose-300/40 bg-rose-500/15 px-3 py-2 text-sm text-rose-100">{error}</p>}
      {isLoading ? (
        <Spinner />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <Card title="Total Users" value={stats?.totalUsers} />
          <Card title="Verified Users" value={stats?.verifiedUsers} />
          <Card title="Total Formations" value={stats?.totalFormations} />
          <Card title="Contact Inquiries" value={stats?.totalContactInquiries} />
          <Card
            title="Registrations (7 days)"
            value={stats?.registrationsLast7Days}
          />
          <Card title="Site Visitors" value={stats?.siteVisitors} />
          <Card title="Page Views" value={stats?.pageViews} />
        </div>
      )}
      <div className="mt-4">
        <BackButton />
      </div>
    </main>
  );
}

function Card({ title, value }: { title: string; value?: number }) {
  return (
    <div className="rounded-xl border border-cyan-300/25 bg-slate-900/45 p-4">
      <div className="text-xs uppercase tracking-[0.12em] text-cyan-100/70">{title}</div>
      <div className="mt-2 text-2xl font-bold text-cyan-200">
        {value ?? "-"}
      </div>
    </div>
  );
}
