"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/inquiries", label: "Inquiries" },
  { href: "/admin/formations", label: "Formations" },
  { href: "/admin/stats", label: "Stats" },
  { href: "/admin/jfa-import", label: "JFA Import" },
];

export default function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="mb-4 space-x-4">
      {links.map((link) => {
        const isActive =
          pathname === link.href || pathname.startsWith(link.href + "/");
        const className = `px-2 py-1 rounded ${
          isActive ? "font-bold bg-gray-200" : ""
        }`;
        return (
          <Link key={link.href} href={link.href} className={className}>
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}

