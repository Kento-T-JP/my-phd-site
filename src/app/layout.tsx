import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Header from "@/components/Header";
import AuthProvider from "@/components/AuthProvider";
import CanvasParticles from "@/components/CanvasParticles";
import Analytics from "@/components/Analytics";
import HomeNav from "@/components/HomeNav";
import Footer from "@/components/Footer";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SAMURAI BLUE Tactical Site",
  description: "SAMURAI BLUEの戦術検討と選手管理のためのアプリケーション",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {

  return (
    <html lang="ja">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <CanvasParticles />
        <AuthProvider>
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only fixed left-3 top-3 z-[80] rounded-md bg-cyan-200 px-3 py-1 text-sm font-semibold text-slate-950"
          >
            メインコンテンツへスキップ
          </a>
          <Header />
          <HomeNav />
          <div className="pt-24 pb-10">
            <Analytics />
            <div id="main-content" className="app-shell">
              {children}
            </div>
            <Footer />
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
