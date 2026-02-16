import { describe, expect, it } from "vitest";
import { formations } from "@/data/formations";
import { resolveFormationTemplate } from "@/components/Formation";

describe("resolveFormationTemplate", () => {
  const fallback = formations.find((f) => f.name === "4-3-3") ?? formations[0];

  it("uses baseFormationName when saved name is an alias", () => {
    const resolved = resolveFormationTemplate(
      {
        name: "My Favorite XI",
        positions: {
          lineupOrder: [],
          benchOrder: [],
          playerPositions: {},
          baseFormationName: "4-2-3-1",
        },
      },
      fallback
    );

    expect(resolved.name).toBe("4-2-3-1");
  });

  it("keeps backward compatibility for old data without baseFormationName", () => {
    const resolved = resolveFormationTemplate(
      {
        name: "4-4-2",
        positions: {
          lineupOrder: [],
          benchOrder: [],
          playerPositions: {},
        },
      },
      fallback
    );

    expect(resolved.name).toBe("4-4-2");
  });
});
