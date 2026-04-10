"use client";

import type { SavedFormation } from "@/types/formation";

export default function FormationCollaborationPanel({
  isOwner,
  activeEditors,
  collaborators,
  collaboratorInput,
  onCollaboratorInputChange,
  onSave,
  collaborationStatus,
  isSavingCollaborators,
}: {
  isOwner: boolean;
  activeEditors: NonNullable<SavedFormation["activeEditors"]>;
  collaborators: NonNullable<SavedFormation["collaborators"]>;
  collaboratorInput: string;
  onCollaboratorInputChange: (value: string) => void;
  onSave: () => void;
  collaborationStatus: string;
  isSavingCollaborators: boolean;
}) {
  return (
    <section className="mb-4 rounded-xl border border-cyan-300/20 bg-slate-950/35 p-3 sm:p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex-1">
          <p className="text-xs tracking-[0.14em] text-cyan-100/70">COLLABORATION</p>
          <p className="mt-1 text-sm text-cyan-50/90">
            {isOwner
              ? "このフォーメーションを編集できるユーザーをメールアドレスで指定します。"
              : "このフォーメーションは共同編集対象として共有されています。"}
          </p>
          <p className="mt-2 text-xs text-cyan-100/70">
            現在編集中:{" "}
            {activeEditors.length > 0
              ? activeEditors.map((editor) => editor.name || editor.email).join(", ")
              : "なし"}
          </p>
          <p className="mt-1 text-xs text-cyan-100/70">
            共同編集者:{" "}
            {collaborators.length > 0
              ? collaborators.map((user) => user.name || user.email).join(", ")
              : "未設定"}
          </p>
        </div>
        {isOwner && (
          <div className="w-full max-w-xl flex-1">
            <textarea
              className="form-input min-h-24 w-full"
              value={collaboratorInput}
              onChange={(e) => onCollaboratorInputChange(e.target.value)}
              placeholder="editor1@example.com, editor2@example.com"
            />
            <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={onSave}
                disabled={isSavingCollaborators}
                className="tap-action rounded bg-cyan-600 px-4 py-2 text-white disabled:opacity-50"
              >
                {isSavingCollaborators ? "保存中…" : "共同編集者を保存"}
              </button>
              {collaborationStatus && (
                <p className="text-xs text-cyan-100/75">{collaborationStatus}</p>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
