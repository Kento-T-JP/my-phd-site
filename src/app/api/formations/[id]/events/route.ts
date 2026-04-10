import { getAccessibleFormation, getFormationActor, mapFormationForClient } from "@/lib/formationAccess";
import { subscribeFormation } from "@/lib/formationRealtime";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function encodeEvent(event: string, payload: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getFormationActor();
  const { id } = await params;
  const formationId = Number(id);
  if (!actor) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (Number.isNaN(formationId)) {
    return new Response("Invalid id", { status: 400 });
  }

  const formation = await getAccessibleFormation(formationId, actor.userId);
  if (!formation) {
    return new Response("Not found", { status: 404 });
  }

  const stream = new ReadableStream({
    start(controller) {
      const subscriberId = `${actor.userId}:${crypto.randomUUID()}`;
      const send = (payload: unknown) => {
        controller.enqueue(encodeEvent("message", payload));
      };

      send({
        type: "formation-updated",
        formationId,
        formation: mapFormationForClient(formation, actor.userId),
        actorUserId: actor.userId,
        occurredAt: new Date().toISOString(),
      });

      const keepAlive = setInterval(() => {
        controller.enqueue(`: keepalive ${Date.now()}\n\n`);
      }, 15_000);

      const unsubscribe = subscribeFormation(formationId, {
        id: subscriberId,
        send,
        close: () => clearInterval(keepAlive),
      });

      const abort = () => {
        clearInterval(keepAlive);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // noop
        }
      };

      _req.signal.addEventListener("abort", abort);
    },
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-cache, no-transform",
      "Content-Type": "text/event-stream",
      Connection: "keep-alive",
    },
  });
}
