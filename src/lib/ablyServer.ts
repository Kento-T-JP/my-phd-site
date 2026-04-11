import * as Ably from "ably";

let client: Ably.Rest | null = null;

function getClient() {
  if (process.env.NODE_ENV === "test") {
    return null;
  }
  if (!process.env.ABLY_API_KEY) {
    return null;
  }
  if (!client) {
    client = new Ably.Rest(process.env.ABLY_API_KEY);
  }
  return client;
}

export async function createAblyTokenRequest(clientId: string) {
  const ably = getClient();
  if (!ably) {
    throw new Error("ABLY_API_KEY is not configured.");
  }
  return ably.auth.createTokenRequest({
    clientId,
    ttl: 60 * 60 * 1000,
  });
}

export async function publishFormationAblyEvent(
  formationId: number,
  eventName: string,
  data: unknown
) {
  const ably = getClient();
  if (!ably) return;
  await ably.channels.get(`formation-state:${formationId}`).publish(eventName, data);
}
