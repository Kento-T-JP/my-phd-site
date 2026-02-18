import Formation from "@/components/Formation";
import JfaImportForm from "@/components/JfaImportForm";
import type { SavedFormation } from "@/types/formation";
import type { Metadata } from "next";
import { getBaseUrl } from "@/lib/url";
import { cookies } from "next/headers";
import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/authOptions";
import prisma from "@/lib/db";
import { fetchPlayers } from "@/lib/fetchPlayers";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default async function Home({
  searchParams,
}: {
  searchParams?: Promise<{ formationId?: string }>;
}) {
  const session = (await getServerSession(authOptions)) as { user?: { id?: string; email?: string; isAdmin?: boolean; status?: string }; loginStage?: string; gatePassed?: boolean } | null;
  if (!session) {
    redirect("/");
  }

  const sessionId = Number(session.user?.id);
  const ownerId = Number.isFinite(sessionId) ? sessionId : undefined;
  const hasPlayers = ownerId
    ? Boolean(
        await prisma.player.findFirst({
          where: {
            userId: ownerId,
            isDeleted: false,
            NOT: { name: { equals: "unknown", mode: "insensitive" } },
          },
          select: { id: true },
        }),
      )
    : (await fetchPlayers()).some(
        (player) => player.name.toLowerCase() !== "unknown",
      );

  const resolvedSearchParams = await searchParams;
  const formationId = resolvedSearchParams?.formationId;
  let initialFormation: SavedFormation | undefined;
  if (formationId) {
    try {
      const num = Number(formationId);
      if (!Number.isNaN(num) && ownerId) {
        const formation = await prisma.formation.findUnique({
          where: { id: num },
          include: { nodes: { orderBy: { id: "asc" } } },
        });
        if (formation && formation.userId === ownerId) {
          initialFormation = formation as SavedFormation;
        }
      } else {
        const cookieStore = await cookies();
        const cookieHeader = cookieStore.toString();
        const baseUrl = await getBaseUrl();
        const res = await fetch(`${baseUrl}/api/formations/${formationId}`, {
          cache: "no-store",
          headers: { cookie: cookieHeader },
        });
        if (res.ok) {
          initialFormation = (await res.json()) as SavedFormation;
        }
      }
    } catch (error) {
      console.error(`Failed to fetch formation ${formationId}:`, error);
      // ignore errors and fall back to default
    }
  }

  if (!hasPlayers) {
    return (
      <main className="py-2 space-y-4">
        <section className="glass-panel p-4 sm:p-6 max-w-3xl mx-auto">
          <p className="inline-flex rounded-full border border-cyan-300/35 bg-cyan-300/10 px-3 py-1 text-[11px] tracking-[0.16em] text-cyan-100/80">
            GET STARTED
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold mt-3 mb-2">JFAメンバーを取り込んで開始</h1>
          <p className="text-sm text-cyan-100/75 mb-5">
            最初に選手データを取り込み、すぐにフォーメーション作成へ進めます。
          </p>
          <JfaImportForm />
        </section>
      </main>
    );
  }

  return (
    <main className="py-2 space-y-4">
      <section className="glass-panel p-4 sm:p-6">
        <p className="inline-flex rounded-full border border-cyan-300/35 bg-cyan-300/10 px-3 py-1 text-[11px] tracking-[0.16em] text-cyan-100/80">
          START XI
        </p>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mt-3">
          Tactical Board
        </h1>
        <p className="text-sm text-cyan-100/75 mt-1">
          フォーメーション作成、選手配置、比較検討を1つの画面で行えます。
        </p>
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div className="rounded-lg border border-cyan-300/20 bg-slate-900/35 px-3 py-2 text-xs text-cyan-100/80">
            直感的なドラッグ配置
          </div>
          <div className="rounded-lg border border-cyan-300/20 bg-slate-900/35 px-3 py-2 text-xs text-cyan-100/80">
            Bench / Off Bench 順序保持
          </div>
          <div className="rounded-lg border border-cyan-300/20 bg-slate-900/35 px-3 py-2 text-xs text-cyan-100/80">
            共有リンクで簡単共有
          </div>
        </div>
      </section>
      <section className="glass-panel p-3 sm:p-5">
        <Formation initialFormation={initialFormation} />
      </section>
    </main>
  );
}
