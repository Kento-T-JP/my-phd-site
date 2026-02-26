"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/inquiries", label: "Inquiries" },
  { href: "/admin/formations", label: "Formations" },
  { href: "/admin/rosters", label: "Squads" },
  { href: "/admin/stats", label: "Stats" },
];

export default function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="glass-panel p-2 sm:p-3">
      <div className="mb-2 px-1 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100/70">
        Admin Navigation
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {links.map((link) => {
          const isActive =
            link.href === "/admin"
              ? pathname === "/admin"
              : pathname === link.href || pathname.startsWith(link.href + "/");
          const className = [
            "whitespace-nowrap rounded-full border px-3 py-1.5 text-sm transition",
            isActive
              ? "border-cyan-300/60 bg-cyan-300/20 text-cyan-50"
              : "border-cyan-300/20 bg-slate-900/35 text-cyan-100/80 hover:border-cyan-200/45 hover:text-cyan-50",
          ].join(" ");
          return (
            <Link key={link.href} href={link.href} className={className}>
              {link.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
