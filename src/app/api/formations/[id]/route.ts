import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/db";
import { FormationUpdateSchema } from "@/lib/schemas/formations";
import { unwrapParams } from "@/lib/unwrap";
import {
  getAccessibleFormation,
  getFormationActor,
  mapFormationForClient,
} from "@/lib/formationAccess";
import { publishFormationEvent } from "@/lib/formationRealtime";

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

async function readFormationId(params: Promise<{ id: string }>) {
  const { id } = await unwrapParams(params);
  const num = Number(id);
  return Number.isNaN(num) ? null : num;
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const wantsPerf = new URL(req.url).searchParams.get("_perf") === "1";
  const profileEnabled = shouldProfileApi() || wantsPerf;
  const profileStart = performance.now();
  const profileSteps: Array<{ step: string; ms: number }> = [];
  const profileStep = (step: string, startedAt: number) => {
    if (!profileEnabled) return;
    profileSteps.push({ step, ms: Number((performance.now() - startedAt).toFixed(2)) });
  };

  let marker = performance.now();
  const formationId = await readFormationId(params);
  profileStep("readFormationId", marker);
  if (!formationId) {
    const totalMs = Number((performance.now() - profileStart).toFixed(2));
    return NextResponse.json(
      { error: "Invalid id" },
      { status: 400, headers: buildPerfHeaders(noStoreHeaders, wantsPerf, totalMs, profileSteps) }
    );
  }

  marker = performance.now();
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
  const formation = await getAccessibleFormation(formationId, actor.userId);
  profileStep("getAccessibleFormation", marker);
  if (!formation) {
    const totalMs = Number((performance.now() - profileStart).toFixed(2));
    return NextResponse.json(
      { error: "Not found" },
      { status: 404, headers: buildPerfHeaders(noStoreHeaders, wantsPerf, totalMs, profileSteps) }
    );
  }

  const totalMs = Number((performance.now() - profileStart).toFixed(2));
  return NextResponse.json(mapFormationForClient(formation, actor.userId), {
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
  const formationId = await readFormationId(params);
  profileStep("readFormationId", marker);
  if (!formationId) {
    const totalMs = Number((performance.now() - profileStart).toFixed(2));
    return NextResponse.json(
      { error: "Invalid id" },
      { status: 400, headers: buildPerfHeaders(undefined, wantsPerf, totalMs, profileSteps) }
    );
  }

  marker = performance.now();
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
  const parsed = FormationUpdateSchema.safeParse(body);
  if (!parsed.success) {
    const totalMs = Number((performance.now() - profileStart).toFixed(2));
    return NextResponse.json(
      { error: parsed.error.issues },
      { status: 400, headers: buildPerfHeaders(undefined, wantsPerf, totalMs, profileSteps) }
    );
  }

  marker = performance.now();
  const formation = await prisma.formation.findFirst({
    where: {
      id: formationId,
      OR: [
        { userId: actor.userId },
        { collaborators: { some: { userId: actor.userId } } },
      ],
    },
    select: {
      id: true,
      userId: true,
      name: true,
      positions: true,
    },
  });
  profileStep("prisma.formation.findFirst", marker);
  if (!formation) {
    const totalMs = Number((performance.now() - profileStart).toFixed(2));
    return NextResponse.json(
      { error: "Not found" },
      { status: 404, headers: buildPerfHeaders(undefined, wantsPerf, totalMs, profileSteps) }
    );
  }

  const normalizedName = (parsed.data.name ?? formation.name).trim();
  marker = performance.now();
  const duplicate = await prisma.formation.findFirst({
    where: {
      userId: formation.userId,
      id: { not: formationId },
      name: { equals: normalizedName, mode: "insensitive" },
    },
    select: { id: true },
  });
  profileStep("prisma.formation.findFirst.duplicate", marker);
  if (duplicate) {
    const totalMs = Number((performance.now() - profileStart).toFixed(2));
    return NextResponse.json(
      { error: "同じ名前のフォーメーションは使用できません。別名にしてください。" },
      { status: 409, headers: buildPerfHeaders(undefined, wantsPerf, totalMs, profileSteps) }
    );
  }

  marker = performance.now();
  await prisma.formationEditSession.upsert({
    where: {
      formationId_userId: {
        formationId,
        userId: actor.userId,
      },
    },
    update: { lastSeenAt: new Date() },
    create: {
      formationId,
      userId: actor.userId,
    },
  });
  profileStep("prisma.formationEditSession.upsert", marker);

  marker = performance.now();
  await prisma.formation.update({
    where: { id: formationId },
    data: {
      name: normalizedName,
      positions: (parsed.data.positions ?? formation.positions) as Prisma.InputJsonValue,
    },
  });
  profileStep("prisma.formation.update", marker);

  marker = performance.now();
  const hydrated = await getAccessibleFormation(formationId, actor.userId);
  profileStep("getAccessibleFormation", marker);
  const mapped = mapFormationForClient(hydrated, actor.userId);

  if (mapped) {
    publishFormationEvent(formationId, {
      type: "formation-updated",
      formationId,
      formation: mapped,
      actorUserId: actor.userId,
      occurredAt: new Date().toISOString(),
    });
  }

  const totalMs = Number((performance.now() - profileStart).toFixed(2));
  return NextResponse.json(mapped, {
    headers: buildPerfHeaders(undefined, wantsPerf, totalMs, profileSteps),
  });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const formationId = await readFormationId(params);
  if (!formationId) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const actor = await getFormationActor();
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formation = await prisma.formation.findUnique({
    where: { id: formationId },
    select: { id: true, userId: true },
  });
  if (!formation) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (formation.userId !== actor.userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.formation.delete({ where: { id: formationId } });
  publishFormationEvent(formationId, {
    type: "formation-updated",
    formationId,
    formation: null,
    actorUserId: actor.userId,
    occurredAt: new Date().toISOString(),
  });
  return NextResponse.json({ success: true });
}
