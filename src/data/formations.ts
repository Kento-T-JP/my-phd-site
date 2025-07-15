import type { Formation } from "@/types/formation";

export const formation433 = {
  name: "4-3-3",
  positions: {
    GK: { top: 85, left: 50, max: 1, allowed: ["GK"] },
    LB: { top: 65, left: 20, max: 1, allowed: ["DF"] },
    CB: { top: 65, left: 50, max: 2, allowed: ["DF"] },
    RB: { top: 65, left: 80, max: 1, allowed: ["DF"] },
    CMF: { top: 45, left: 50, max: 3, allowed: ["MF/FW"] },
    LW: { top: 25, left: 20, max: 1, allowed: ["MF/FW"] },
    CF: { top: 15, left: 50, max: 1, allowed: ["MF/FW"] },
    RW: { top: 25, left: 80, max: 1, allowed: ["MF/FW"] },
  },
} as const satisfies Formation;

export const formation442 = {
  name: "4-4-2",
  positions: {
    GK: { top: 85, left: 50, max: 1, allowed: ["GK"] },
    LB: { top: 65, left: 20, max: 1, allowed: ["DF"] },
    CB: { top: 65, left: 50, max: 2, allowed: ["DF"] },
    RB: { top: 65, left: 80, max: 1, allowed: ["DF"] },
    LM: { top: 35, left: 20, max: 1, allowed: ["MF/FW"] },
    CMF: { top: 40, left: 50, max: 2, allowed: ["MF/FW"] },
    RM: { top: 35, left: 80, max: 1, allowed: ["MF/FW"] },
    CF: { top: 15, left: 50, max: 2, allowed: ["MF/FW"] },
  },
} as const satisfies Formation;

export const formation4231 = {
  name: "4-2-3-1",
  positions: {
    // Back line
    GK: { top: 85, left: 50, max: 1, allowed: ["GK"] },
    LB: { top: 65, left: 20, max: 1, allowed: ["DF"] },
    CB: { top: 65, left: 50, max: 2, allowed: ["DF"] },
    RB: { top: 65, left: 80, max: 1, allowed: ["DF"] },
    // Double pivot
    DMF: { top: 47, left: 50, max: 2, allowed: ["MF/FW"] },
    // Attacking midfield three
    LW: { top: 30, left: 25, max: 1, allowed: ["MF/FW"] },
    CMF: { top: 30, left: 50, max: 1, allowed: ["MF/FW"] },
    RW: { top: 30, left: 75, max: 1, allowed: ["MF/FW"] },
    // Lone striker
    CF: { top: 10, left: 50, max: 1, allowed: ["MF/FW"] },
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