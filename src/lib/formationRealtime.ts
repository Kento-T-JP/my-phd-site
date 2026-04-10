type Subscriber = {
  id: string;
  send: (event: FormationRealtimeEvent) => void;
  close: () => void;
};

export type FormationRealtimeEvent =
  | {
      type: "formation-updated";
      formationId: number;
      formation: unknown;
      actorUserId: number;
      occurredAt: string;
    }
  | {
      type: "presence";
      formationId: number;
      editors: Array<{
        id: number;
        name: string | null;
        email: string;
        lastSeenAt: Date | string;
      }>;
      occurredAt: string;
    };

const hub = globalThis as typeof globalThis & {
  __formationRealtimeSubscribers?: Map<number, Map<string, Subscriber>>;
};

function getSubscribers() {
  if (!hub.__formationRealtimeSubscribers) {
    hub.__formationRealtimeSubscribers = new Map();
  }
  return hub.__formationRealtimeSubscribers;
}

export function subscribeFormation(
  formationId: number,
  subscriber: Subscriber
) {
  const subscribers = getSubscribers();
  const room = subscribers.get(formationId) ?? new Map<string, Subscriber>();
  room.set(subscriber.id, subscriber);
  subscribers.set(formationId, room);

  return () => {
    const current = subscribers.get(formationId);
    current?.delete(subscriber.id);
    subscriber.close();
    if (current && current.size === 0) {
      subscribers.delete(formationId);
    }
  };
}

export function publishFormationEvent(
  formationId: number,
  event: FormationRealtimeEvent
) {
  const room = getSubscribers().get(formationId);
  if (!room) return;
  for (const subscriber of room.values()) {
    subscriber.send(event);
  }
}
