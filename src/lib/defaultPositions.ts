import { formations } from "@/data/formations";

export function getDefaultPositions(): string[] {
  return Array.from(
    new Set([...formations.flatMap((f) => Object.keys(f.positions)), "DF", "MF/FW"])
  );
}
