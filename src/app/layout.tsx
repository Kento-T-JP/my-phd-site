import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Header from "@/components/Header";
import AuthProvider from "@/components/AuthProvider";
import CanvasParticles from "@/components/CanvasParticles";
import Analytics from "@/components/Analytics";
import { Analytics as VercelAnalytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import HomeNav from "@/components/HomeNav";
import Footer from "@/components/Footer";
import { getSiteUrl } from "@/lib/siteUrl";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = getSiteUrl();

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Start XI",
    template: "%s | Start XI",
  },
  description: "サッカーのフォーメーション作成と選手・ロスター管理を行うアプリケーション。",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: siteUrl,
    siteName: "Start XI",
    title: "Start XI",
    description: "サッカーのフォーメーション作成と選手・ロスター管理を行うアプリケーション。",
    images: [{ url: "/emblem.svg" }],
    locale: "ja_JP",
  },
  twitter: {
    card: "summary_large_image",
    title: "Start XI",
    description: "サッカーのフォーメーション作成と選手・ロスター管理を行うアプリケーション。",
    images: ["/emblem.svg"],
  },
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
  },
  robots: {
    index: true,
    follow: true,
  },
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
        <div className="relative z-10">
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
              <VercelAnalytics />
              <SpeedInsights />
              <div id="main-content" className="app-shell">
                {children}
              </div>
              <Footer />
            </div>
          </AuthProvider>
        </div>
      </body>
    </html>
  );
}
