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
      <div className="p-6 rounded-lg shadow hover:bg-gray-50 transition">
        {icon && <div className="text-3xl mb-2">{icon}</div>}
        <h2 className="text-lg font-semibold">{title}</h2>
      </div>
    </Link>
  );
}
