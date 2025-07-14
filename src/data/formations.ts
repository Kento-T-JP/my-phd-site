import type { Formation } from "@/types/formation";

export const formation433 = {
  name: "4-3-3",
  positions: {
    GK: { top: 85, left: 50, max: 1 },
    LB: { top: 65, left: 20, max: 1 },
    CB: { top: 65, left: 50, max: 2 },
    RB: { top: 65, left: 80, max: 1 },
    CMF: { top: 45, left: 50, max: 3 },
    LW: { top: 25, left: 20, max: 1 },
    CF: { top: 15, left: 50, max: 1 },
    RW: { top: 25, left: 80, max: 1 },
  },
} as const satisfies Formation;

export const formation442 = {
  name: "4-4-2",
  positions: {
    GK: { top: 85, left: 50, max: 1 },
    LB: { top: 65, left: 20, max: 1 },
    CB: { top: 65, left: 50, max: 2 },
    RB: { top: 65, left: 80, max: 1 },
    LM: { top: 35, left: 20, max: 1 },
    CMF: { top: 40, left: 50, max: 2 },
    RM: { top: 35, left: 80, max: 1 },
    CF: { top: 15, left: 50, max: 2 },
  },
} as const satisfies Formation;

export const formation4231 = {
  name: "4-2-3-1",
  positions: {
    // Back line
    GK: { top: 85, left: 50, max: 1 },
    LB: { top: 65, left: 20, max: 1 },
    CB: { top: 65, left: 50, max: 2 },
    RB: { top: 65, left: 80, max: 1 },
    // Double pivot
    DMF: { top: 47, left: 50, max: 2 },
    // Attacking midfield three
    LW: { top: 30, left: 25, max: 1 },
    CMF: { top: 30, left: 50, max: 1 },
    RW: { top: 30, left: 75, max: 1 },
    // Lone striker
    CF: { top: 10, left: 50, max: 1 },
  },
} as const satisfies Formation;

/**
 * すべてのフォーメーションを配列でまとめる。
 * Formation.tsx などで map して動的 UI を生成するために使用。
 */
export const formations = [
  formation433,
  formation442,
  formation4231,
] as const satisfies readonly Formation[];