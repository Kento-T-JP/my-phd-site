import Link from "next/link";
import type { ReactNode } from "react";

interface AdminCardProps {
  href: string;
  title: string;
  icon?: ReactNode;
}

export default function AdminCard({ href, title, icon }: AdminCardProps) {
  return (
    <Link href={href} className="group block">
      <div className="h-full rounded-xl border border-cyan-300/20 bg-slate-900/45 p-4 text-cyan-50 shadow-[0_10px_24px_rgba(1,10,30,0.22)] transition hover:-translate-y-0.5 hover:border-cyan-300/45 hover:bg-slate-900/60">
        {icon && <div className="mb-2 text-2xl">{icon}</div>}
        <h2 className="text-base font-semibold sm:text-lg">{title}</h2>
        <p className="mt-1 text-xs text-cyan-100/70 sm:text-sm">
          Open {title.toLowerCase()} management
        </p>
      </div>
    </Link>
  );
}
