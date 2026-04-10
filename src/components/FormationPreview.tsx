"use client";

import Formation, { type InitialFormation } from "@/components/Formation";

export default function FormationPreview({
  initialFormation,
  screenshotMode = false,
}: {
  initialFormation?: InitialFormation;
  screenshotMode?: boolean;
}) {
  return (
    <Formation
      initialFormation={initialFormation}
      screenshotMode={screenshotMode}
      mode="standalone"
    />
  );
}
