import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { FormationCreateSchema } from "@/lib/schemas/formations";
import {
  getAccessibleFormation,
  getFormationActor,
  mapFormationForClient,
} from "@/lib/formationAccess";

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
  const actor = await getFormationActor();
  profileStep("getFormationActor", marker);
  if (!actor) {
    const totalMs = Number((performance.now() - profileStart).toFixed(2));
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: buildPerfHeaders(noStoreHeaders, wantsPerf, totalMs, profileSteps) }
    );
  }

  marker = performance.now();
  const list = await prisma.formation.findMany({
    where: {
      OR: [
        { userId: actor.userId },
        { collaborators: { some: { userId: actor.userId } } },
      ],
    },
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    include: {
      nodes: { orderBy: { id: "asc" } },
      user: { select: { id: true, name: true, email: true } },
      collaborators: {
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      },
      editSessions: {
        where: { lastSeenAt: { gte: new Date(Date.now() - 30_000) } },
        orderBy: { lastSeenAt: "desc" },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      },
    },
  });
  profileStep("prisma.formation.findMany", marker);

  const mapped = list
    .map((formation) => mapFormationForClient(formation, actor.userId))
    .filter(Boolean);

  const totalMs = Number((performance.now() - profileStart).toFixed(2));
  return NextResponse.json(mapped, {
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
  const actor = await getFormationActor();
  profileStep("getFormationActor", marker);
  if (!actor) {
    const totalMs = Number((performance.now() - profileStart).toFixed(2));
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
      userId: actor.userId,
      name: { equals: normalizedName, mode: "insensitive" },
    },
    select: { id: true },
  });
  profileStep("prisma.formation.findFirst", marker);
  if (duplicate) {
    const totalMs = Number((performance.now() - profileStart).toFixed(2));
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
      userId: actor.userId,
      nodes: nodes
        ? {
            create: nodes.map((node) => ({
              x: node.x,
              y: node.y,
              playerId: node.playerId,
            })),
          }
        : undefined,
    },
    select: { id: true },
  });
  profileStep("prisma.formation.create", marker);

  marker = performance.now();
  const hydrated = await getAccessibleFormation(saved.id, actor.userId);
  profileStep("getAccessibleFormation", marker);

  const totalMs = Number((performance.now() - profileStart).toFixed(2));
  return NextResponse.json(mapFormationForClient(hydrated, actor.userId), {
    status: 201,
    headers: buildPerfHeaders(undefined, wantsPerf, totalMs, profileSteps),
  });
}
