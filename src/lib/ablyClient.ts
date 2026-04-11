"use client";

import * as Ably from "ably";

const globalWithAbly = globalThis as typeof globalThis & {
  __startXiAblyClient?: Ably.Realtime;
};

export function getAblyClient() {
  if (!globalWithAbly.__startXiAblyClient) {
    globalWithAbly.__startXiAblyClient = new Ably.Realtime({
      authUrl: "/api/realtime/ably-token",
      autoConnect: true,
      closeOnUnload: true,
      logLevel: 0,
    });
  }
  return globalWithAbly.__startXiAblyClient;
}
