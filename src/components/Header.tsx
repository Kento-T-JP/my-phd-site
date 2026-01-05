"use client";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useSession, signOut } from "next-auth/react";
import Button from "./ui/Button";

export default function Header() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const showHome = pathname !== "/home";
  const homeHref = "/home";
  const homeLabel = "Home";
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  return (
    <header className="fixed top-0 left-0 w-full z-50 bg-transparent backdrop-blur-md border-b border-white/20 transition-colors text-white flex items-center p-4 flex-wrap sm:flex-nowrap">
      <Image
        src="/emblem.svg"
        alt="Samurai Blue Emblem"
        width={40}
        height={40}
        className="mr-2"
      />
      <span className="text-xl font-bold flex-grow">SAMURAI BLUE</span>
      <Button
        className="sm:hidden"
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
        className={`${isMenuOpen ? "block" : "hidden"} w-full sm:block sm:w-auto`}
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
          {showHome && (
            <Link href={homeHref} className="underline">
              {homeLabel}
            </Link>
          )}
          {session ? (
            <>
                <span className="text-sm max-w-[300px] truncate">
                {session.user?.email
                  ? `Logged in as ${session.user.email}`
                  : "Logged in"}
              </span>
              <Link href="/formations" className="underline">
                Formations
              </Link>
              <Link href="/mypage" className="underline">
                My Page
              </Link>
              <Button onClick={() => signOut()} className="underline" type="button">
                Logout
              </Button>
            </>
          ) : (
            <>
              <Link href="/" className="underline">
                Login
              </Link>
              <Link href="/register" className="underline">
                Register
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
