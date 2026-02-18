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
      <main className="py-2">
        <section className="glass-panel p-4 sm:p-6 max-w-2xl mx-auto">
          <h1 className="text-2xl font-bold mb-2">JFAメンバーインポート</h1>
          <p className="text-sm text-cyan-100/75 mb-5">
            まずは選手データを取り込んで、フォーメーション作成を開始してください。
          </p>
          <JfaImportForm />
        </section>
      </main>
    );
  }

  return (
    <main className="py-2">
      <section className="mb-4 px-1">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
          Starting Eleven Tactical Preview
        </h1>
        <p className="text-sm text-cyan-100/75 mt-1">
          フォーメーション作成、選手配置、比較検討を1つの画面で行えます。
        </p>
      </section>
      <section className="glass-panel p-3 sm:p-5">
        <Formation initialFormation={initialFormation} />
      </section>
    </main>
  );
}
