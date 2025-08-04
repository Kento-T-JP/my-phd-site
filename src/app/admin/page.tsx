import Link from "next/link";

export default function AdminPage() {
  return (
    <main className="p-8">
      <h1 className="text-xl font-bold mb-4">Admin Dashboard</h1>
      <ul className="list-disc pl-5 space-y-2">
        <li>
          <Link href="/admin/users">Users</Link>
        </li>
        <li>
          <Link href="/admin/inquiries">Inquiries</Link>
        </li>
        <li>
          <Link href="/admin/formations">Formations</Link>
        </li>
        <li>
          <Link href="/admin/stats">Stats</Link>
        </li>
        <li>
          <Link href="/admin/contact">Contact</Link>
        </li>
        <li>
          <Link href="/admin/jfa-import">JFA Import</Link>
        </li>
      </ul>
    </main>
  );
}

