"use client";

import { useState } from "react";
import Link from "next/link";

interface HomeNavProps {
  isAdmin?: boolean;
}

export default function HomeNav({ isAdmin = false }: HomeNavProps) {
  const [isOpen, setIsOpen] = useState(false);

  const links = [
    { href: "/players/new", label: "新規選手登録" },
    { href: "/players", label: "選手一覧を編集" },
    { href: "/admin/jfa-import", label: "JFAメンバーインポート" },
    { href: "/contact", label: "お問い合わせ" },
  ];

  return (
    <nav className="mb-6 relative z-50">
      <button
        type="button"
        className="text-yellow-300 hover:text-white hover:underline md:hidden"
        aria-haspopup="true"
        aria-expanded={isOpen}
        aria-controls="home-nav-menu"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label="メニュー"
      >
        <svg
          className="w-6 h-6"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
        <line x1="3" y1="6" x2="21" y2="6" />
        <line x1="3" y1="12" x2="21" y2="12" />
        <line x1="3" y1="18" x2="21" y2="18" />
      </svg>
    </button>
      <div
        className={`fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 ${
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setIsOpen(false)}
      />
      <ul
        id="home-nav-menu"
        className={`absolute mt-2 z-50 bg-blue-900/50 border border-cyan-400/20 rounded-md backdrop-blur-sm space-y-2 transition-transform duration-300 transition-opacity transform ${
          isOpen
            ? "translate-y-0 opacity-100"
            : "-translate-y-4 opacity-0 pointer-events-none"
        }`}
      >
        {links.map((link) => (
          <li key={link.href} className="py-2 px-4">
            <Link
              href={link.href}
              className="block text-yellow-300 hover:text-white hover:underline transition-colors"
            >
              {link.label}
            </Link>
          </li>
        ))}
        {isAdmin && (
          <li className="py-2 px-4">
            <Link
              href="/admin"
              className="block text-yellow-300 hover:text-white hover:underline transition-colors"
            >
              管理者画面
            </Link>
          </li>
        )}
      </ul>
    </nav>
  );
}

