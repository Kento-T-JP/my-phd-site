import type { Formation } from "@/types/formation";

export const formation433 = {
  name: "4-3-3",
  positions: {
    GK: { top: 90, left: 50, max: 1 },
    LB: { top: 70, left: 20, max: 1 },
    CB: { top: 70, left: 50, max: 2 },
    RB: { top: 70, left: 80, max: 1 },
    CM: { top: 50, left: 50, max: 3 },
    LW: { top: 30, left: 20, max: 1 },
    ST: { top: 20, left: 50, max: 1 },
    RW: { top: 30, left: 80, max: 1 },
  },
} as const satisfies Formation;

export const formation442 = {
  name: "4-4-2",
  positions: {
    GK: { top: 90, left: 50, max: 1 },
    LB: { top: 70, left: 20, max: 1 },
    CB: { top: 70, left: 50, max: 2 },
    RB: { top: 70, left: 80, max: 1 },
    LM: { top: 40, left: 20, max: 1 },
    CM: { top: 45, left: 50, max: 2 },
    RM: { top: 40, left: 80, max: 1 },
    ST: { top: 20, left: 50, max: 2 },
  },
} as const satisfies Formation;