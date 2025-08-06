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

  const renderLinks = () => (
    <>
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
    </>
  );

  return (
    <nav className="mb-6 relative">
      <button
        ref={buttonRef}
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
      <ul className="hidden md:flex gap-4">
        {renderLinks()}
      </ul>
      <aside
        id="home-nav-menu"
        ref={menuRef}
        className={`fixed top-0 left-0 h-full w-64 bg-blue-900/50 border border-cyan-400/20 px-4 py-6 rounded-md backdrop-blur-sm transform transition-transform md:hidden ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <ul className="space-y-2">
          {renderLinks()}
        </ul>
      </aside>
    </nav>
  );
}

