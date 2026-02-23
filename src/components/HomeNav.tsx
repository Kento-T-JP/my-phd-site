"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import useClickSound from "@/lib/useClickSound";

export default function HomeNav() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const isAdmin = Boolean((session?.user as { isAdmin?: boolean } | undefined)?.isAdmin);
  const [isOpen, setIsOpen] = useState(false);
  const [headerHeight, setHeaderHeight] = useState(76);
  const menuRef = useRef<HTMLElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const { play, muted, toggleMuted } = useClickSound();

  const links = [
    { href: "/players/new", label: "新規選手登録", auth: true },
    { href: "/players", label: "選手一覧を編集", auth: true },
    { href: "/tournaments", label: "大会を管理", auth: true },
    { href: "/positions", label: "ポジションを管理", auth: true },
    { href: "/players/import", label: "Excelインポート", auth: true },
    { href: "/jfa-import", label: "JFAメンバーインポート", auth: true },
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

  useEffect(() => {
    const header = document.querySelector("header");
    if (!header) return;

    const updateHeaderHeight = () => {
      const measured = Math.ceil(header.getBoundingClientRect().height);
      if (measured > 0) setHeaderHeight(measured);
    };

    updateHeaderHeight();
    const rafId = window.requestAnimationFrame(updateHeaderHeight);
    const timeoutId = window.setTimeout(updateHeaderHeight, 200);

    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(() => {
        updateHeaderHeight();
      });
      observer.observe(header);
    }

    window.addEventListener("resize", updateHeaderHeight);
    window.addEventListener("orientationchange", updateHeaderHeight);
    return () => {
      window.cancelAnimationFrame(rafId);
      window.clearTimeout(timeoutId);
      observer?.disconnect();
      window.removeEventListener("resize", updateHeaderHeight);
      window.removeEventListener("orientationchange", updateHeaderHeight);
    };
  }, [pathname, session?.user?.email]);

  const buttonTop = headerHeight + 4;
  const menuTop = Math.max(0, headerHeight + 2);

  return (
    <nav aria-label="サイドメニュー">
      <button
        ref={buttonRef}
        type="button"
        className="fixed left-4 z-[60] text-cyan-50 hover:text-white bg-slate-950/82 border border-cyan-200/55 rounded-full p-2.5 shadow-[0_6px_20px_rgba(0,8,28,0.42)] backdrop-blur-md"
        style={{ top: `${buttonTop}px` }}
        aria-haspopup="true"
        aria-expanded={isOpen}
        aria-controls="home-nav-menu"
        onClick={() => {
          play();
          setIsOpen((prev) => !prev);
        }}
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
          className="fixed inset-x-0 bottom-0 bg-black/45 z-30"
          style={{ top: `${menuTop}px` }}
          onClick={() => setIsOpen(false)}
        />
      )}
      <aside
        id="home-nav-menu"
        ref={menuRef}
        className={`fixed bottom-0 left-0 w-72 bg-slate-950/78 border-r border-cyan-300/18 p-4 backdrop-blur-md transform transition-all duration-300 ease-in-out z-40 ${
          isOpen ? "translate-x-0 opacity-100" : "-translate-x-full opacity-0"
        }`}
        style={{ top: `${menuTop}px` }}
      >
        <p className="text-xs uppercase tracking-[0.2em] text-cyan-100/65 mb-3 px-3">
          Quick Actions
        </p>
        <ul className="space-y-1.5">
          {links
            .filter((link) => !link.auth || !!session)
            .map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className={`block py-2.5 px-3 rounded-xl transition-all duration-200 ease-in-out ${
                    pathname === link.href
                      ? "bg-cyan-300/20 text-white"
                      : "text-cyan-100/85 hover:text-white hover:bg-cyan-300/12"
                  }`}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          {isAdmin && (
            <li>
              <Link
                href="/admin"
                className={`block py-2.5 px-3 rounded-xl transition-all duration-200 ease-in-out ${
                  pathname === "/admin"
                    ? "bg-cyan-300/20 text-white"
                    : "text-cyan-100/85 hover:text-white hover:bg-cyan-300/12"
                }`}
              >
                管理者画面
              </Link>
            </li>
          )}
          <li>
            <button
              type="button"
              onClick={() => {
                toggleMuted();
              }}
              className="w-full text-left py-2.5 px-3 rounded-xl transition-all duration-200 ease-in-out text-cyan-100/85 hover:text-white hover:bg-cyan-300/12"
            >
              サウンド: {muted ? "OFF" : "ON"}
            </button>
          </li>
        </ul>
      </aside>
    </nav>
  );
}
