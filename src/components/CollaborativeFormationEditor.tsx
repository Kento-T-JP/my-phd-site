"use client";

import Formation, { type InitialFormation } from "@/components/Formation";
import type { SavedFormation } from "@/types/formation";

export default function CollaborativeFormationEditor({
  initialFormation,
  onUpdated,
}: {
  initialFormation?: InitialFormation;
  onUpdated?: (updated?: SavedFormation) => void;
}) {
  return (
    <Formation
      initialFormation={initialFormation}
      onUpdated={onUpdated}
      mode="collaborative"
    />
  );
}
