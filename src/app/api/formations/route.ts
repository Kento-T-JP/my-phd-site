import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import { FormationCreateSchema } from "@/lib/schemas/formations";

export const dynamic = "force-dynamic";

const noStoreHeaders = { "Cache-Control": "no-store" };
const shouldProfileApi = () =>
  /^(1|true|on|yes)$/i.test(String(process.env.DEBUG_API_PERF ?? ""));

function buildPerfHeaders(
  base: HeadersInit | undefined,
  wantsPerf: boolean,
  totalMs: number,
  steps: Array<{ step: string; ms: number }>
) {
  const headers = new Headers(base);
  if (!wantsPerf) return headers;
  headers.set("x-api-perf-total-ms", String(totalMs));
  headers.set("x-api-perf-steps", JSON.stringify(steps));
  return headers;
}

async function getUser() {
  const session = (await getServerSession(authOptions)) as { user?: { id?: string; email?: string; isAdmin?: boolean; status?: string }; loginStage?: string; gatePassed?: boolean } | null;
  if (!session?.user?.email) return null;
  return prisma.user.findUnique({ where: { email: session.user.email } });
}

export async function GET(req: Request) {
  const wantsPerf = new URL(req.url).searchParams.get("_perf") === "1";
  const profileEnabled = shouldProfileApi() || wantsPerf;
  const profileStart = performance.now();
  const profileSteps: Array<{ step: string; ms: number }> = [];
  const profileStep = (step: string, startedAt: number) => {
    if (!profileEnabled) return;
    profileSteps.push({ step, ms: Number((performance.now() - startedAt).toFixed(2)) });
  };

  let marker = performance.now();
  const user = await getUser();
  profileStep("getUser", marker);
  if (!user) {
    const totalMs = Number((performance.now() - profileStart).toFixed(2));
    if (profileEnabled) {
      console.log("[API_PERF] /api/formations GET", {
        authorized: false,
        totalMs,
        steps: profileSteps,
      });
    }
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: buildPerfHeaders(noStoreHeaders, wantsPerf, totalMs, profileSteps) }
    );
  }
  marker = performance.now();
  const list = await prisma.formation.findMany({
    where: { userId: user.id },
    orderBy: { id: "asc" },
    include: { nodes: { orderBy: { id: "asc" } } },
  });
  profileStep("prisma.formation.findMany", marker);
  const totalMs = Number((performance.now() - profileStart).toFixed(2));
  if (profileEnabled) {
    console.log("[API_PERF] /api/formations GET", {
      authorized: true,
      userId: user.id,
      resultCount: list.length,
      totalMs,
      steps: profileSteps,
    });
  }
  return NextResponse.json(list, {
    headers: buildPerfHeaders(noStoreHeaders, wantsPerf, totalMs, profileSteps),
  });
}

export async function POST(req: Request) {
  const wantsPerf = new URL(req.url).searchParams.get("_perf") === "1";
  const profileEnabled = shouldProfileApi() || wantsPerf;
  const profileStart = performance.now();
  const profileSteps: Array<{ step: string; ms: number }> = [];
  const profileStep = (step: string, startedAt: number) => {
    if (!profileEnabled) return;
    profileSteps.push({ step, ms: Number((performance.now() - startedAt).toFixed(2)) });
  };

  let marker = performance.now();
  const user = await getUser();
  profileStep("getUser", marker);
  if (!user) {
    const totalMs = Number((performance.now() - profileStart).toFixed(2));
    if (profileEnabled) {
      console.log("[API_PERF] /api/formations POST", {
        authorized: false,
        totalMs,
        steps: profileSteps,
      });
    }
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: buildPerfHeaders(undefined, wantsPerf, totalMs, profileSteps) }
    );
  }
  marker = performance.now();
  const body = await req.json();
  profileStep("parseJsonBody", marker);
  const parsed = FormationCreateSchema.safeParse(body);
  if (!parsed.success) {
    const totalMs = Number((performance.now() - profileStart).toFixed(2));
    if (profileEnabled) {
      console.log("[API_PERF] /api/formations POST", {
        authorized: true,
        userId: user.id,
        validation: "failed",
        totalMs,
        steps: profileSteps,
      });
    }
    return NextResponse.json(
      { error: parsed.error.issues },
      { status: 400, headers: buildPerfHeaders(undefined, wantsPerf, totalMs, profileSteps) }
    );
  }
  const { name, positions, nodes } = parsed.data;
  const normalizedName = (name || "Untitled").trim();
  marker = performance.now();
  const duplicate = await prisma.formation.findFirst({
    where: {
      userId: user.id,
      name: { equals: normalizedName, mode: "insensitive" },
    },
    select: { id: true },
  });
  profileStep("prisma.formation.findFirst", marker);
  if (duplicate) {
    const totalMs = Number((performance.now() - profileStart).toFixed(2));
    if (profileEnabled) {
      console.log("[API_PERF] /api/formations POST", {
        authorized: true,
        userId: user.id,
        duplicate: true,
        totalMs,
        steps: profileSteps,
      });
    }
    return NextResponse.json(
      { error: "同じ名前のフォーメーションは保存できません。別名にしてください。" },
      { status: 409, headers: buildPerfHeaders(undefined, wantsPerf, totalMs, profileSteps) }
    );
  }
  marker = performance.now();
  const saved = await prisma.formation.create({
    data: {
      name: normalizedName,
      positions,
      userId: user.id,
      nodes: nodes
        ? {
            create: nodes.map((n) => ({
              x: n.x,
              y: n.y,
              playerId: n.playerId,
            })),
          }
        : undefined,
    },
    include: { nodes: { orderBy: { id: "asc" } } },
  });
  profileStep("prisma.formation.create", marker);
  const totalMs = Number((performance.now() - profileStart).toFixed(2));
  if (profileEnabled) {
    console.log("[API_PERF] /api/formations POST", {
      authorized: true,
      userId: user.id,
      savedId: saved.id,
      nodeCount: saved.nodes.length,
      totalMs,
      steps: profileSteps,
    });
  }
  return NextResponse.json(saved, {
    status: 201,
    headers: buildPerfHeaders(undefined, wantsPerf, totalMs, profileSteps),
  });
}
