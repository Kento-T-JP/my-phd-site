import AdminCard from "@/components/AdminCard";
import PageMain from "@/components/PageMain";

export default function AdminPage() {
  return (
    <PageMain className="p-4 sm:p-8">
      <h1 className="text-xl font-bold mb-6 text-black">Admin Dashboard</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <AdminCard href="/admin/users" title="Users" icon="👥" />
        <AdminCard href="/admin/formations" title="Formations" icon="📝" />
        <AdminCard href="/admin/stats" title="Stats" icon="📊" />
      </div>
    </PageMain>
  );
}
