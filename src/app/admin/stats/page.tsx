"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import BackButton from "@/components/BackButton";
import Spinner from "@/components/Spinner";
import PageMain from "@/components/PageMain";

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
      <PageMain className="p-4 sm:p-8">
        <Spinner />
      </PageMain>
    );
  }

  if (!session) {
    return (
      <PageMain className="p-4 sm:p-8">
        <p>
          Please <Link href="/login">login</Link> to view this page.
        </p>
      </PageMain>
    );
  }

  if (!session.user?.isAdmin) {
    return (
      <PageMain className="p-4 sm:p-8">
        <p>Unauthorized</p>
      </PageMain>
    );
  }

  return (
    <PageMain className="p-4 sm:p-8">
      <h1 className="text-xl font-bold mb-4">Stats</h1>
      {error && <p className="text-red-500 mb-4">{error}</p>}
      {isLoading ? (
        <Spinner />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
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
    </PageMain>
  );
}

function Card({ title, value }: { title: string; value?: number }) {
  return (
    <div className="border rounded p-4">
      <div className="text-sm text-white">{title}</div>
      <div className="text-2xl font-bold text-indigo-300 dark:text-indigo-400">
        {value ?? "-"}
      </div>
    </div>
  );
}
