"use client";
import Image from "next/image";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";

export default function Header() {
  const { data: session } = useSession();
  return (
    <header className="bg-[#002D62] text-white flex items-center p-4">
      <Image
        src="/emblem.svg"
        alt="Samurai Blue Emblem"
        width={40}
        height={40}
        className="mr-2"
      />
      <span className="text-xl font-bold flex-grow">SAMURAI BLUE</span>
      {session ? (
        <div className="flex items-center space-x-4">
          <span className="text-sm">
            {session.user?.email
              ? `Logged in as ${session.user.email}`
              : "Logged in"}
          </span>
          <Link href="/mypage" className="underline">
            My Page
          </Link>
          <button onClick={() => signOut()} className="underline">
            Logout
          </button>
        </div>
      ) : (
        <div className="space-x-4">
          <Link href="/login" className="underline">
            Login
          </Link>
          <Link href="/register" className="underline">
            Register
          </Link>
        </div>
      )}
    </header>
  );
}

