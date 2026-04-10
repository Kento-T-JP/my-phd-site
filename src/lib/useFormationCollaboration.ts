"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SavedFormation } from "@/types/formation";

type RealtimeFormationMessage =
  | {
      type: "formation-updated";
      formationId: number;
      formation: SavedFormation | null;
      actorUserId: number;
      occurredAt: string;
    }
  | {
      type: "presence";
      formationId: number;
      editors: NonNullable<SavedFormation["activeEditors"]>;
      occurredAt: string;
    };

export function useFormationCollaboration({
  enabled,
  formationId,
  sessionUserId,
  initialCollaborators,
  initialActiveEditors,
  onFormationReceived,
  onDeleted,
  buildPersistedPayload,
}: {
  enabled: boolean;
  formationId?: number;
  sessionUserId?: string;
  initialCollaborators?: NonNullable<SavedFormation["collaborators"]>;
  initialActiveEditors?: NonNullable<SavedFormation["activeEditors"]>;
  onFormationReceived: (formation: SavedFormation) => void;
  onDeleted: () => void;
  buildPersistedPayload: () => {
    name: string;
    positions: SavedFormation["positions"];
    clientInstanceId: string;
  };
}) {
  const [syncStatus, setSyncStatus] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);
  const [collaboratorInput, setCollaboratorInput] = useState("");
  const [collaborationStatus, setCollaborationStatus] = useState("");
  const [isSavingCollaborators, setIsSavingCollaborators] = useState(false);
  const [activeEditors, setActiveEditors] = useState<
    NonNullable<SavedFormation["activeEditors"]>
  >(initialActiveEditors ?? []);
  const [collaborators, setCollaborators] = useState<
    NonNullable<SavedFormation["collaborators"]>
  >(initialCollaborators ?? []);
  const skipNextSyncRef = useRef(true);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setCollaborators(initialCollaborators ?? []);
    setActiveEditors(initialActiveEditors ?? []);
    setCollaboratorInput((initialCollaborators ?? []).map((item) => item.email).join(", "));
    skipNextSyncRef.current = true;
  }, [initialActiveEditors, initialCollaborators]);

  useEffect(() => {
    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
    };
  }, []);

  const syncExistingFormation = useCallback(
    async (opts?: { immediate?: boolean }) => {
      if (!enabled || !formationId) return null;
      const execute = async () => {
        setIsSyncing(true);
        setSyncStatus("同期中…");
        try {
          const res = await fetch(`/api/formations/${formationId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(buildPersistedPayload()),
          });
          const data = (await res.json().catch(() => null)) as SavedFormation | { error?: string } | null;
          if (!res.ok) {
            setSyncStatus(
              data && typeof data === "object" && "error" in data && typeof data.error === "string"
                ? data.error
                : "同期に失敗しました"
            );
            return null;
          }
          const updated = data as SavedFormation;
          setCollaborators(updated.collaborators ?? []);
          setActiveEditors(updated.activeEditors ?? []);
          setSyncStatus("他ユーザーと同期済み");
          return updated;
        } catch {
          setSyncStatus("同期に失敗しました");
          return null;
        } finally {
          setIsSyncing(false);
        }
      };

      if (opts?.immediate) {
        if (autosaveTimerRef.current) {
          clearTimeout(autosaveTimerRef.current);
          autosaveTimerRef.current = null;
        }
        return execute();
      }

      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
      autosaveTimerRef.current = setTimeout(() => {
        void execute();
      }, 500);
      return null;
    },
    [buildPersistedPayload, enabled, formationId]
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

  useEffect(() => {
    if (!enabled || !formationId) return;
    if (skipNextSyncRef.current) {
      skipNextSyncRef.current = false;
      return;
    }
    void syncExistingFormation();
  }, [buildPersistedPayload, enabled, formationId, syncExistingFormation]);

  useEffect(() => {
    if (!enabled || !formationId) return;

    const updatePresence = async (method: "POST" | "DELETE" = "POST") => {
      try {
        await fetch(`/api/formations/${formationId}/presence`, {
          method,
          keepalive: method === "DELETE",
        });
      } catch {
        // ignore presence failures
      }
    };

    void updatePresence("POST");
    const intervalId = setInterval(() => {
      void updatePresence("POST");
    }, 15_000);

    return () => {
      clearInterval(intervalId);
      void updatePresence("DELETE");
    };
  }, [enabled, formationId]);

  useEffect(() => {
    if (!enabled || !formationId) return;
    const numericSessionUserId = Number(sessionUserId);
    const source = new EventSource(`/api/formations/${formationId}/events`);
    source.addEventListener("message", (event) => {
      const payload = JSON.parse(event.data) as RealtimeFormationMessage;
      if (payload.type === "presence") {
        setActiveEditors(payload.editors ?? []);
        return;
      }
      if (payload.actorUserId === numericSessionUserId) {
        return;
      }
      if (!payload.formation) {
        setSyncStatus("このフォーメーションは削除されました");
        onDeleted();
        return;
      }
      setSyncStatus("他ユーザーの変更を反映しました");
      skipNextSyncRef.current = true;
      setCollaborators(payload.formation.collaborators ?? []);
      setActiveEditors(payload.formation.activeEditors ?? []);
      onFormationReceived(payload.formation);
    });
    source.onerror = () => {
      setSyncStatus("リアルタイム接続を再試行中…");
    };
    return () => {
      source.close();
    };
  }, [enabled, formationId, onDeleted, onFormationReceived, sessionUserId]);

  return {
    syncStatus,
    isSyncing,
    collaboratorInput,
    setCollaboratorInput,
    collaborationStatus,
    isSavingCollaborators,
    activeEditors,
    collaborators,
    syncExistingFormation,
    saveCollaborators,
  };
}
