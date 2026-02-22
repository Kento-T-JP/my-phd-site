import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import { FormationUpdateSchema } from "@/lib/schemas/formations";
import { unwrapParams } from "@/lib/unwrap";

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
  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  return user;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const wantsPerf = new URL(_req.url).searchParams.get("_perf") === "1";
  const profileEnabled = shouldProfileApi() || wantsPerf;
  const profileStart = performance.now();
  const profileSteps: Array<{ step: string; ms: number }> = [];
  const profileStep = (step: string, startedAt: number) => {
    if (!profileEnabled) return;
    profileSteps.push({ step, ms: Number((performance.now() - startedAt).toFixed(2)) });
  };

  let marker = performance.now();
  const { id } = await unwrapParams(params);
  profileStep("unwrapParams", marker);
  const num = Number(id);
  if (Number.isNaN(num)) {
    const totalMs = Number((performance.now() - profileStart).toFixed(2));
    return NextResponse.json(
      { error: "Invalid id" },
      {
        status: 400,
        headers: buildPerfHeaders(noStoreHeaders, wantsPerf, totalMs, profileSteps),
      }
    );
  }
  marker = performance.now();
  const user = await getUser();
  profileStep("getUser", marker);
  if (!user) {
    const totalMs = Number((performance.now() - profileStart).toFixed(2));
    return NextResponse.json(
      { error: "Unauthorized" },
      {
        status: 401,
        headers: buildPerfHeaders(noStoreHeaders, wantsPerf, totalMs, profileSteps),
      }
    );
  }
  marker = performance.now();
  const formation = await prisma.formation.findUnique({
    where: { id: num },
    include: { nodes: { orderBy: { id: "asc" } } },
  });
  profileStep("prisma.formation.findUnique", marker);
  if (!formation || formation.userId !== user.id) {
    const totalMs = Number((performance.now() - profileStart).toFixed(2));
    return NextResponse.json(
      { error: "Not found" },
      {
        status: 404,
        headers: buildPerfHeaders(noStoreHeaders, wantsPerf, totalMs, profileSteps),
      }
    );
  }
  const totalMs = Number((performance.now() - profileStart).toFixed(2));
  if (profileEnabled) {
    console.log("[API_PERF] /api/formations/[id] GET", {
      userId: user.id,
      id: num,
      nodeCount: formation.nodes.length,
      totalMs,
      steps: profileSteps,
    });
  }
  return NextResponse.json(formation, {
    headers: buildPerfHeaders(noStoreHeaders, wantsPerf, totalMs, profileSteps),
  });
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const wantsPerf = new URL(req.url).searchParams.get("_perf") === "1";
  const profileEnabled = shouldProfileApi() || wantsPerf;
  const profileStart = performance.now();
  const profileSteps: Array<{ step: string; ms: number }> = [];
  const profileStep = (step: string, startedAt: number) => {
    if (!profileEnabled) return;
    profileSteps.push({ step, ms: Number((performance.now() - startedAt).toFixed(2)) });
  };

  let marker = performance.now();
  const { id } = await unwrapParams(params);
  profileStep("unwrapParams", marker);
  const num = Number(id);
  if (Number.isNaN(num)) {
    const totalMs = Number((performance.now() - profileStart).toFixed(2));
    return NextResponse.json(
      { error: "Invalid id" },
      { status: 400, headers: buildPerfHeaders(undefined, wantsPerf, totalMs, profileSteps) }
    );
  }
  marker = performance.now();
  const user = await getUser();
  profileStep("getUser", marker);
  if (!user) {
    const totalMs = Number((performance.now() - profileStart).toFixed(2));
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: buildPerfHeaders(undefined, wantsPerf, totalMs, profileSteps) }
    );
  }
  marker = performance.now();
  const body = await req.json();
  profileStep("parseJsonBody", marker);
  const parsed = FormationUpdateSchema.safeParse(body);
  if (!parsed.success) {
    const totalMs = Number((performance.now() - profileStart).toFixed(2));
    return NextResponse.json(
      { error: parsed.error.issues },
      { status: 400, headers: buildPerfHeaders(undefined, wantsPerf, totalMs, profileSteps) }
    );
  }
  const data = parsed.data;
  marker = performance.now();
  const formation = await prisma.formation.findUnique({ where: { id: num } });
  profileStep("prisma.formation.findUnique", marker);
  if (!formation || formation.userId !== user.id) {
    const totalMs = Number((performance.now() - profileStart).toFixed(2));
    return NextResponse.json(
      { error: "Not found" },
      { status: 404, headers: buildPerfHeaders(undefined, wantsPerf, totalMs, profileSteps) }
    );
  }
  const normalizedName = (data.name ?? formation.name).trim();
  marker = performance.now();
  const duplicate = await prisma.formation.findFirst({
    where: {
      userId: user.id,
      id: { not: num },
      name: { equals: normalizedName, mode: "insensitive" },
    },
    select: { id: true },
  });
  profileStep("prisma.formation.findFirst", marker);
  if (duplicate) {
    const totalMs = Number((performance.now() - profileStart).toFixed(2));
    return NextResponse.json(
      { error: "同じ名前のフォーメーションは使用できません。別名にしてください。" },
      { status: 409, headers: buildPerfHeaders(undefined, wantsPerf, totalMs, profileSteps) }
    );
  }
  marker = performance.now();
  const updated = await prisma.formation.update({
    where: { id: num },
    data: {
      name: normalizedName,
      positions: (data.positions ?? formation.positions) as Prisma.InputJsonValue,
    },
  });
  profileStep("prisma.formation.update", marker);
  const totalMs = Number((performance.now() - profileStart).toFixed(2));
  if (profileEnabled) {
    console.log("[API_PERF] /api/formations/[id] PUT", {
      userId: user.id,
      id: num,
      updatedId: updated.id,
      totalMs,
      steps: profileSteps,
    });
  }
  return NextResponse.json(updated, {
    headers: buildPerfHeaders(undefined, wantsPerf, totalMs, profileSteps),
  });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await unwrapParams(params);
  const num = Number(id);
  if (Number.isNaN(num)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const formation = await prisma.formation.findUnique({ where: { id: num } });
  if (!formation || formation.userId !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await prisma.formation.delete({ where: { id: num } });
  return NextResponse.json({ success: true });
}
