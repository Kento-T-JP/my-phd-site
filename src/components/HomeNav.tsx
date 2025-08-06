"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

interface HomeNavProps {
  isAdmin?: boolean;
}

export default function HomeNav({ isAdmin = false }: HomeNavProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const links = [
    { href: "/players/new", label: "新規選手登録" },
    { href: "/players", label: "選手一覧を編集" },
    { href: "/admin/jfa-import", label: "JFAメンバーインポート" },
    { href: "/contact", label: "お問い合わせ" },
  ];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <nav>
      <button
        ref={buttonRef}
        type="button"
        className="fixed top-17 left-6 z-50 text-yellow-300 hover:text-white"
        aria-haspopup="true"
        aria-expanded={isOpen}
        aria-controls="home-nav-menu"
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <span className="sr-only">メニュー</span>
        <svg
          className="h-6 w-6"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
      <aside
        id="home-nav-menu"
        ref={menuRef}
        className={`fixed inset-y-0 left-0 w-64 bg-blue-900/50 border border-cyan-400/20 p-4 backdrop-blur-sm transform transition-all duration-300 ease-in-out z-50 ${
          isOpen ? "translate-x-0 opacity-100" : "-translate-x-full opacity-0"
        }`}
      >
        <ul className="space-y-2">
          {links.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="block py-2 px-4 text-yellow-300 hover:text-white hover:underline transition-all duration-300 ease-in-out hover:translate-x-1 hover:opacity-80"
              >
                {link.label}
              </Link>
            </li>
          ))}
          {isAdmin && (
            <li>
              <Link
                href="/admin"
                className="block py-2 px-4 text-yellow-300 hover:text-white hover:underline transition-all duration-300 ease-in-out hover:translate-x-1 hover:opacity-80"
              >
                管理者画面
              </Link>
            </li>
          )}
        </ul>
      </aside>
    </nav>
  );
}

