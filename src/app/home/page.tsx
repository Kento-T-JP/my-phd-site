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
import { resolveSessionUserId } from "@/lib/sessionUser";

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
  const shouldProfileHome = /^(1|true|on|yes)$/i.test(
    String(process.env.DEBUG_HOME_PERF ?? "")
  );
  const profileStart = performance.now();
  const profileSteps: Array<{ step: string; ms: number }> = [];
  const profileStep = (step: string, startedAt: number) => {
    if (!shouldProfileHome) return;
    profileSteps.push({ step, ms: Number((performance.now() - startedAt).toFixed(2)) });
  };

  const resolvedSearchParamsPromise =
    searchParams ?? Promise.resolve<{ formationId?: string } | undefined>(undefined);

  let marker = performance.now();
  const session = (await getServerSession(authOptions)) as { user?: { id?: string; email?: string; isAdmin?: boolean; status?: string }; loginStage?: string; gatePassed?: boolean } | null;
  profileStep("getServerSession", marker);
  if (!session) {
    redirect("/");
  }

  marker = performance.now();
  const sessionId = Number(session.user?.id);
  let ownerId = Number.isFinite(sessionId) ? sessionId : undefined;
  if (!ownerId && process.env.NODE_ENV !== "test") {
    try {
      const { userId } = await resolveSessionUserId(session);
      ownerId = Number.isFinite(userId) ? Number(userId) : undefined;
    } catch {
      ownerId = undefined;
    }
  }
  profileStep("resolveOwnerId", marker);

  const hasPlayersPromise = (async () => {
    const hasPlayersMarker = performance.now();
    const value = ownerId
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
      : process.env.NODE_ENV === "test"
        ? (await fetchPlayers()).some(
            (player) => player.name.toLowerCase() !== "unknown",
          )
        : false;
    profileStep(
      ownerId
        ? "hasPlayers:prisma.findFirst"
        : process.env.NODE_ENV === "test"
          ? "hasPlayers:fetchPlayers(testOnly)"
          : "hasPlayers:skippedNoOwner",
      hasPlayersMarker
    );
    return value;
  })();

  const initialFormationPromise = (async (): Promise<{
    formationId?: string;
    initialFormation?: SavedFormation;
  }> => {
    const searchParamsMarker = performance.now();
    const resolvedSearchParams = await resolvedSearchParamsPromise;
    profileStep("resolveSearchParams", searchParamsMarker);
    const formationId = resolvedSearchParams?.formationId;
    let initialFormation: SavedFormation | undefined;
    if (formationId) {
      try {
        const num = Number(formationId);
        if (!Number.isNaN(num) && ownerId) {
          const loadMarker = performance.now();
          const formation = await prisma.formation.findUnique({
            where: { id: num },
            include: { nodes: { orderBy: { id: "asc" } } },
          });
          profileStep("initialFormation:prisma.findUnique", loadMarker);
          if (formation && formation.userId === ownerId) {
            initialFormation = formation as SavedFormation;
          }
        } else {
          const loadMarker = performance.now();
          const cookieStore = await cookies();
          const cookieHeader = cookieStore.toString();
          const baseUrl = await getBaseUrl();
          const res = await fetch(`${baseUrl}/api/formations/${formationId}`, {
            cache: "no-store",
            headers: { cookie: cookieHeader },
          });
          profileStep("initialFormation:fetchApi", loadMarker);
          if (res.ok) {
            const parseMarker = performance.now();
            initialFormation = (await res.json()) as SavedFormation;
            profileStep("initialFormation:parseJson", parseMarker);
          }
        }
      } catch (error) {
        console.error(`Failed to fetch formation ${formationId}:`, error);
      }
    }
    return { formationId, initialFormation };
  })();

  const [hasPlayers, formationState] = await Promise.all([
    hasPlayersPromise,
    initialFormationPromise,
  ]);
  const { formationId, initialFormation } = formationState;

  if (shouldProfileHome) {
    const totalMs = Number((performance.now() - profileStart).toFixed(2));
    console.log("[HOME_PERF]", {
      ownerId: ownerId ?? null,
      hasPlayers,
      formationId: formationId ?? null,
      totalMs,
      steps: profileSteps,
    });
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
