import AdminCard from "@/components/AdminCard";

export default function AdminPage() {
  return (
    <main className="p-8 bg-gray-50 rounded-lg">
      <h1 className="text-xl font-bold mb-6 text-black">Admin Dashboard</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <AdminCard href="/admin/users" title="Users" icon="👥" />
        <AdminCard href="/admin/formations" title="Formations" icon="📝" />
        <AdminCard href="/admin/stats" title="Stats" icon="📊" />
        <AdminCard href="/admin/jfa-import" title="JFA Import" icon="⬇️" />
      </div>
    </main>
  );
}
