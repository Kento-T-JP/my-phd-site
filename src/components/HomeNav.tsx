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
        className="text-yellow-300 hover:text-white hover:underline"
        aria-haspopup="true"
        aria-expanded={isOpen}
        aria-controls="home-nav-menu"
        onClick={() => setIsOpen((prev) => !prev)}
      >
        メニュー
      </button>
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50"
            onClick={() => setIsOpen(false)}
          />
          <ul
            id="home-nav-menu"
            className="absolute mt-2 z-50 bg-blue-900/50 border border-cyan-400/20 px-4 py-2 rounded-md backdrop-blur-sm"
          >
            {links.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="block py-1 text-yellow-300 hover:text-white hover:underline transition-colors"
                >
                  {link.label}
                </Link>
              </li>
            ))}
            {isAdmin && (
              <li>
                <Link
                  href="/admin"
                  className="block py-1 text-yellow-300 hover:text-white hover:underline transition-colors"
                >
                  管理者画面
                </Link>
              </li>
            )}
          </ul>
        </>
      )}
    </nav>
  );
}

