import Link from "next/link";
import type { ReactNode } from "react";

interface AdminCardProps {
  href: string;
  title: string;
  icon?: ReactNode;
}

export default function AdminCard({ href, title, icon }: AdminCardProps) {
  return (
    <Link href={href} className="block">
      <div className="p-6 rounded-lg bg-white text-gray-800 shadow transition transform hover:shadow-lg hover:-translate-y-1 hover:bg-gray-50">
        {icon && <div className="text-3xl mb-2 text-blue-600">{icon}</div>}
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
      </div>
    </Link>
  );
}
