"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import BackButton from "@/components/BackButton";

type Stats = {
  totalUsers: number;
  verifiedUsers: number;
  totalFormations: number;
  totalContactInquiries: number;
  registrationsLast7Days: number;
};

export default function StatsPage() {
  const { data: session, status } = useSession();
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    if (status === "authenticated") {
      fetch("/api/admin/stats")
        .then((res) => res.ok && res.json().then(setStats));
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

  return (
    <main className="p-8">
      <h1 className="text-xl font-bold mb-4">Stats</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        <Card title="Total Users" value={stats?.totalUsers} />
        <Card title="Verified Users" value={stats?.verifiedUsers} />
        <Card title="Total Formations" value={stats?.totalFormations} />
        <Card title="Contact Inquiries" value={stats?.totalContactInquiries} />
        <Card
          title="Registrations (7 days)"
          value={stats?.registrationsLast7Days}
        />
      </div>
      <div className="mt-4">
        <BackButton />
      </div>
    </main>
  );
}

function Card({ title, value }: { title: string; value?: number }) {
  return (
    <div className="border rounded p-4">
      <div className="text-sm text-gray-600">{title}</div>
      <div className="text-2xl font-bold">{value ?? "-"}</div>
    </div>
  );
}
