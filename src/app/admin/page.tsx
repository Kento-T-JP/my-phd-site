import AdminCard from "@/components/AdminCard";

export default function AdminPage() {
  return (
    <main className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold text-cyan-50 sm:text-3xl">Admin Dashboard</h1>
        <p className="mt-1 text-sm text-cyan-100/75 sm:text-base">
          User, content, squad and analytics operations in one place.
        </p>
      </header>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <AdminCard href="/admin/users" title="Users" icon="👥" />
        <AdminCard href="/admin/inquiries" title="Inquiries" icon="📨" />
        <AdminCard href="/admin/formations" title="Formations" icon="📝" />
        <AdminCard href="/admin/rosters" title="Squads" icon="🏆" />
        <AdminCard href="/admin/stats" title="Stats" icon="📊" />
      </div>
    </main>
  );
}
