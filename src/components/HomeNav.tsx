"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

interface HomeNavProps {
  isAdmin?: boolean;
}

export default function HomeNav({ isAdmin = false }: HomeNavProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLUListElement>(null);
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
    <nav className="mb-6 relative">
      <button
        ref={buttonRef}
        type="button"
        className="text-yellow-300 hover:text-white hover:underline"
        aria-haspopup="true"
        aria-expanded={isOpen}
        aria-controls="home-nav-menu"
        onClick={() => setIsOpen((prev) => !prev)}
      >
        メニュー
      </button>
      <ul
        id="home-nav-menu"
        ref={menuRef}
        className={`absolute mt-2 bg-blue-900/50 border border-cyan-400/20 px-4 py-2 rounded-md backdrop-blur-sm ${
          isOpen ? "block" : "hidden"
        }`}
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
    </nav>
  );
}

