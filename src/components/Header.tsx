"use client";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import Button from "./ui/Button";

export default function Header() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const isFullyAuthenticated = session?.loginStage === "credentials";
  const navLinks = [
    { href: "/home", label: "Home" },
    { href: "/formations", label: "Formations" },
    { href: "/mypage", label: "My Page" },
  ];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!isMenuOpen) return;
      if (!headerRef.current) return;
      if (!headerRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isMenuOpen]);

  useEffect(() => {
    setIsMenuOpen(false);
  }, [pathname]);

  return (
    <header ref={headerRef} className="fixed top-0 left-0 w-full z-50 border-b border-cyan-200/20 bg-slate-950/55 backdrop-blur-md text-white">
      <div className="app-shell flex items-center p-3 gap-2 flex-wrap sm:flex-nowrap">
        <Link href="/home" className="flex items-center gap-2">
          <Image
            src="/emblem.svg"
            alt="Start XI Emblem"
            width={40}
            height={40}
            unoptimized
            className="mr-1"
          />
          <div className="min-w-0">
            <p className="text-lg sm:text-xl font-bold tracking-[0.12em] leading-none">START XI</p>
            <p className="text-[10px] sm:text-[11px] text-cyan-100/70 tracking-[0.14em] mt-1 leading-none">
              TACTICAL WORKSPACE
            </p>
          </div>
        </Link>
        {isFullyAuthenticated ? (
          <>
            <Button
              className="sm:hidden ghost-btn ml-auto"
              onClick={() => setIsMenuOpen((open) => !open)}
              aria-controls="primary-navigation"
              aria-expanded={isMenuOpen}
              type="button"
            >
              <span className="sr-only">Toggle navigation</span>
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </Button>
            <nav
              id="primary-navigation"
              className={`${isMenuOpen ? "block" : "hidden"} w-full sm:block sm:w-auto sm:ml-auto`}
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2">
                {session ? (
                  <>
                    {navLinks.map((link) => (
                      <Link
                        key={link.href}
                        href={link.href}
                        className={`nav-link ${pathname === link.href ? "active" : ""}`}
                      >
                        {link.label}
                      </Link>
                    ))}
                    <span className="text-xs sm:text-sm max-w-[260px] truncate px-2 py-1 text-cyan-100/75">
                      {session.user?.email
                        ? `Logged in as ${session.user.email}`
                        : "Logged in"}
                    </span>
                    <Button
                      onClick={() =>
                        signOut({ callbackUrl: "/access-status?status=signedout" })
                      }
                      className="ghost-btn"
                      type="button"
                    >
                      Logout
                    </Button>
                  </>
                ) : (
                  <>
                    <Link href="/" className="nav-link">
                      Login
                    </Link>
                    <Link href="/register" className="nav-link">
                      Register
                    </Link>
                  </>
                )}
              </div>
            </nav>
          </>
        ) : null}
      </div>
    </header>
  );
}
