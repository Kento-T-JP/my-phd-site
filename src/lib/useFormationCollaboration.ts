"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Message, PresenceMessage } from "ably";
import { getAblyClient } from "@/lib/ablyClient";
import type { CollaborativeFormationDraft, SavedFormation } from "@/types/formation";

type CollaboratorUpdateEvent = {
  collaborators: NonNullable<SavedFormation["collaborators"]>;
  occurredAt: string;
};

type PlayerMovedEvent = {
  playerId: number;
  top: number;
  left: number;
  actorUserId?: number;
  clientInstanceId: string;
  occurredAt: string;
};

function getAblyErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  if (
    typeof error === "object" &&
    error &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }
  return fallback;
}

function mapPresenceMembers(
  members: PresenceMessage[]
): NonNullable<SavedFormation["activeEditors"]> {
  const seen = new Set<string>();
  return members
    .filter((member) => {
      const key = `${member.clientId}:${member.connectionId}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((member) => ({
      id: Number(String(member.clientId).replace("user-", "")) || 0,
      name:
        typeof member.data === "object" &&
        member.data &&
        "name" in member.data &&
        typeof member.data.name === "string"
          ? member.data.name
          : null,
      email:
        typeof member.data === "object" &&
        member.data &&
        "email" in member.data &&
        typeof member.data.email === "string"
          ? member.data.email
          : String(member.clientId),
      lastSeenAt: new Date(member.timestamp ?? Date.now()),
    }));
}

export function useFormationCollaboration({
  enabled,
  formationId,
  isDragging,
  sessionUserId,
  sessionUserName,
  sessionUserEmail,
  initialCollaborators,
  initialActiveEditors,
  draftPayload,
  onRemotePlayerMove,
  onRemoteDraftReceived,
  onDeleted,
}: {
  enabled: boolean;
  formationId?: number;
  isDragging: boolean;
  sessionUserId?: string;
  sessionUserName?: string | null;
  sessionUserEmail?: string | null;
  initialCollaborators?: NonNullable<SavedFormation["collaborators"]>;
  initialActiveEditors?: NonNullable<SavedFormation["activeEditors"]>;
  draftPayload: CollaborativeFormationDraft;
  onRemotePlayerMove: (event: {
    playerId: number;
    top: number;
    left: number;
  }) => void;
  onRemoteDraftReceived: (draft: CollaborativeFormationDraft) => void;
  onDeleted: () => void;
}) {
  const [syncStatus, setSyncStatus] = useState("");
  const [collaboratorInput, setCollaboratorInput] = useState("");
  const [collaborationStatus, setCollaborationStatus] = useState("");
  const [isSavingCollaborators, setIsSavingCollaborators] = useState(false);
  const [activeEditors, setActiveEditors] = useState<
    NonNullable<SavedFormation["activeEditors"]>
  >(initialActiveEditors ?? []);
  const [collaborators, setCollaborators] = useState<
    NonNullable<SavedFormation["collaborators"]>
  >(initialCollaborators ?? []);
  const skipNextPublishRef = useRef(true);
  const lastPublishedSignatureRef = useRef("");
  const publishTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingMoveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingMoveRef = useRef<PlayerMovedEvent | null>(null);
  const lastMoveSentAtRef = useRef(0);
  const remotePlayerMoveHandlerRef = useRef(onRemotePlayerMove);
  const remoteDraftHandlerRef = useRef(onRemoteDraftReceived);
  const deletedHandlerRef = useRef(onDeleted);

  const stateChannelName = useMemo(
    () => (formationId ? `formation-state:${formationId}` : ""),
    [formationId]
  );
  const moveChannelName = useMemo(
    () => (formationId ? `formation-move:${formationId}` : ""),
    [formationId]
  );
  const draftSignature = useMemo(
    () =>
      JSON.stringify({
        name: draftPayload.name,
        positions: draftPayload.positions,
      }),
    [draftPayload.name, draftPayload.positions]
  );

  useEffect(() => {
    setCollaborators(initialCollaborators ?? []);
    setActiveEditors(initialActiveEditors ?? []);
    setCollaboratorInput((initialCollaborators ?? []).map((item) => item.email).join(", "));
    skipNextPublishRef.current = true;
  }, [initialActiveEditors, initialCollaborators]);

  useEffect(() => {
    remotePlayerMoveHandlerRef.current = onRemotePlayerMove;
  }, [onRemotePlayerMove]);

  useEffect(() => {
    remoteDraftHandlerRef.current = onRemoteDraftReceived;
  }, [onRemoteDraftReceived]);

  useEffect(() => {
    deletedHandlerRef.current = onDeleted;
  }, [onDeleted]);

  useEffect(() => {
    if (!enabled || !formationId || !stateChannelName || !moveChannelName) return;

    const client = getAblyClient();
    const stateChannel = client.channels.get(stateChannelName);
    const moveChannel = client.channels.get(moveChannelName);
    let isCancelled = false;

    const refreshPresence = async () => {
      try {
        const members = await stateChannel.presence.get();
        if (!isCancelled) {
          setActiveEditors(mapPresenceMembers(members as PresenceMessage[]));
        }
      } catch {
        if (!isCancelled) {
          setSyncStatus("参加者情報の取得に失敗しました");
        }
      }
    };

    const setup = async () => {
      try {
        await Promise.all([stateChannel.attach(), moveChannel.attach()]);
        await stateChannel.presence.enter({
          name: sessionUserName ?? null,
          email: sessionUserEmail ?? `user-${sessionUserId ?? "unknown"}`,
        });
        await refreshPresence();
        if (!isCancelled) {
          setSyncStatus("共同編集に接続しました");
        }
      } catch (error) {
        if (!isCancelled) {
          setSyncStatus(
            getAblyErrorMessage(error, "共同編集への接続に失敗しました")
          );
        }
      }
    };

    const onDraft = (message: Message) => {
      const payload = message.data as CollaborativeFormationDraft;
      if (!payload || payload.clientInstanceId === draftPayload.clientInstanceId) {
        return;
      }
      if (payload.actorUserId === Number(sessionUserId)) {
        return;
      }
      skipNextPublishRef.current = true;
      lastPublishedSignatureRef.current = JSON.stringify({
        name: payload.name,
        positions: payload.positions,
      });
      setSyncStatus("他ユーザーの変更を反映しました");
      remoteDraftHandlerRef.current(payload);
    };

    const onPlayerMoved = (message: Message) => {
      const payload = message.data as PlayerMovedEvent;
      if (!payload || payload.clientInstanceId === draftPayload.clientInstanceId) {
        return;
      }
      if (payload.actorUserId === Number(sessionUserId)) {
        return;
      }
      skipNextPublishRef.current = true;
      setSyncStatus("他ユーザーが選手を移動中");
      remotePlayerMoveHandlerRef.current({
        playerId: payload.playerId,
        top: payload.top,
        left: payload.left,
      });
    };

    const onCollaboratorsUpdated = (message: Message) => {
      const payload = message.data as CollaboratorUpdateEvent;
      setCollaborators(payload.collaborators ?? []);
      setCollaboratorInput((payload.collaborators ?? []).map((item) => item.email).join(", "));
    };

    const onDeletedEvent = () => {
      setSyncStatus("この共同編集セッションは終了しました");
      deletedHandlerRef.current();
    };

    const onPresenceChanged = () => {
      void refreshPresence();
    };

    void setup();
    void stateChannel.subscribe("draft-updated", onDraft);
    void moveChannel.subscribe("player-moved", onPlayerMoved);
    void stateChannel.subscribe("collaborators-updated", onCollaboratorsUpdated);
    void stateChannel.subscribe("formation-deleted", onDeletedEvent);
    void stateChannel.presence.subscribe(["enter", "leave", "update"], onPresenceChanged);

    return () => {
      isCancelled = true;
      stateChannel.unsubscribe("draft-updated", onDraft);
      moveChannel.unsubscribe("player-moved", onPlayerMoved);
      stateChannel.unsubscribe("collaborators-updated", onCollaboratorsUpdated);
      stateChannel.unsubscribe("formation-deleted", onDeletedEvent);
      stateChannel.presence.unsubscribe(["enter", "leave", "update"], onPresenceChanged);
      if (publishTimerRef.current) {
        clearTimeout(publishTimerRef.current);
        publishTimerRef.current = null;
      }
      if (pendingMoveTimeoutRef.current) {
        clearTimeout(pendingMoveTimeoutRef.current);
        pendingMoveTimeoutRef.current = null;
      }
      pendingMoveRef.current = null;
      try {
        if (stateChannel.state === "attached") {
          void stateChannel.presence.leave().catch(() => undefined);
        }
      } catch {
        // ignore cleanup failures after auth/connect errors
      }
    };
  }, [
    moveChannelName,
    draftPayload.clientInstanceId,
    enabled,
    formationId,
    sessionUserEmail,
    sessionUserId,
    sessionUserName,
    stateChannelName,
  ]);

  useEffect(() => {
    if (!enabled || !stateChannelName) return;
    if (isDragging) {
      if (publishTimerRef.current) {
        clearTimeout(publishTimerRef.current);
        publishTimerRef.current = null;
      }
      return;
    }
    if (skipNextPublishRef.current) {
      skipNextPublishRef.current = false;
      return;
    }
    if (draftSignature === lastPublishedSignatureRef.current) {
      return;
    }
    if (publishTimerRef.current) {
      clearTimeout(publishTimerRef.current);
      publishTimerRef.current = null;
    }

    const client = getAblyClient();
    const channel = client.channels.get(stateChannelName);
    publishTimerRef.current = setTimeout(() => {
      const payload = {
        ...draftPayload,
        occurredAt: new Date().toISOString(),
      };
      void channel.publish("draft-updated", payload).then(
        () => {
          lastPublishedSignatureRef.current = draftSignature;
          publishTimerRef.current = null;
          setSyncStatus("共同編集中");
        },
        () => {
          publishTimerRef.current = null;
          setSyncStatus("共同編集イベントの送信に失敗しました");
        }
      );
    }, 250);

    return () => {
      if (publishTimerRef.current) {
        clearTimeout(publishTimerRef.current);
        publishTimerRef.current = null;
      }
    };
  }, [draftPayload, draftSignature, enabled, isDragging, stateChannelName]);

  const publishPlayerMove = useCallback(
    (playerId: number, top: number, left: number) => {
      if (!enabled || !moveChannelName) return;
      const now = Date.now();
      const payload: PlayerMovedEvent = {
        playerId,
        top,
        left,
        actorUserId: sessionUserId ? Number(sessionUserId) : undefined,
        clientInstanceId: draftPayload.clientInstanceId,
        occurredAt: new Date().toISOString(),
      };
      const publishNow = () => {
        const client = getAblyClient();
        const channel = client.channels.get(moveChannelName);
        pendingMoveRef.current = null;
        lastMoveSentAtRef.current = Date.now();
        void channel.publish("player-moved", payload).catch(() => {
          setSyncStatus("共同編集イベントの送信に失敗しました");
        });
      };

      const MOVE_THROTTLE_MS = 180;
      if (now - lastMoveSentAtRef.current >= MOVE_THROTTLE_MS) {
        if (pendingMoveTimeoutRef.current) {
          clearTimeout(pendingMoveTimeoutRef.current);
          pendingMoveTimeoutRef.current = null;
        }
        publishNow();
        return;
      }

      pendingMoveRef.current = payload;
      if (pendingMoveTimeoutRef.current) {
        return;
      }
      pendingMoveTimeoutRef.current = setTimeout(() => {
        pendingMoveTimeoutRef.current = null;
        const nextPayload = pendingMoveRef.current;
        if (!nextPayload) return;
        const client = getAblyClient();
        const channel = client.channels.get(moveChannelName);
        pendingMoveRef.current = null;
        lastMoveSentAtRef.current = Date.now();
        void channel.publish("player-moved", nextPayload).catch(() => {
          setSyncStatus("共同編集イベントの送信に失敗しました");
        });
      }, MOVE_THROTTLE_MS);
    },
    [draftPayload.clientInstanceId, enabled, moveChannelName, sessionUserId]
  );

  const publishDraftNow = useCallback(
    (draft: CollaborativeFormationDraft) => {
      if (!enabled || !stateChannelName) return;
      const signature = JSON.stringify({
        name: draft.name,
        positions: draft.positions,
      });
      if (publishTimerRef.current) {
        clearTimeout(publishTimerRef.current);
        publishTimerRef.current = null;
      }
      lastPublishedSignatureRef.current = signature;
      const client = getAblyClient();
      const channel = client.channels.get(stateChannelName);
      const payload = {
        ...draft,
        occurredAt: new Date().toISOString(),
      };
      void channel.publish("draft-updated", payload).then(
        () => setSyncStatus("共同編集中"),
        () => setSyncStatus("共同編集イベントの送信に失敗しました")
      );
    },
    [enabled, stateChannelName]
  );

  const saveCollaborators = useCallback(async () => {
    if (!enabled || !formationId) return null;
    setIsSavingCollaborators(true);
    setCollaborationStatus("");
    const emails = collaboratorInput
      .split(/[\n,]/)
      .map((entry) => entry.trim())
      .filter(Boolean);
    try {
      const res = await fetch(`/api/formations/${formationId}/collaborators`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emails }),
      });
      const data = (await res.json().catch(() => null)) as SavedFormation | { error?: string } | null;
      if (!res.ok) {
        setCollaborationStatus(
          data && typeof data === "object" && "error" in data && typeof data.error === "string"
            ? data.error
            : "共同編集ユーザーの保存に失敗しました"
        );
        return null;
      }
      const updated = data as SavedFormation;
      setCollaborators(updated.collaborators ?? []);
      setActiveEditors(updated.activeEditors ?? []);
      setCollaboratorInput((updated.collaborators ?? []).map((item) => item.email).join(", "));
      setCollaborationStatus("共同編集ユーザーを更新しました");
      return updated;
    } catch {
      setCollaborationStatus("共同編集ユーザーの保存に失敗しました");
      return null;
    } finally {
      setIsSavingCollaborators(false);
    }
  }, [collaboratorInput, enabled, formationId]);

  return {
    syncStatus,
    collaboratorInput,
    setCollaboratorInput,
    collaborationStatus,
    isSavingCollaborators,
    activeEditors,
    collaborators,
    publishDraftNow,
    publishPlayerMove,
    saveCollaborators,
  };
}
