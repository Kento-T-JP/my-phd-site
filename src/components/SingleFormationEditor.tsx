"use client";

import Formation, { type InitialFormation } from "@/components/Formation";
import type { SavedFormation } from "@/types/formation";

export default function SingleFormationEditor({
  initialFormation,
  onSaved,
  onUpdated,
}: {
  initialFormation?: InitialFormation;
  onSaved?: (saved: SavedFormation) => void;
  onUpdated?: (updated?: SavedFormation) => void;
}) {
  return (
    <Formation
      initialFormation={initialFormation}
      onSaved={onSaved}
      onUpdated={onUpdated}
      mode="single"
    />
  );
}
