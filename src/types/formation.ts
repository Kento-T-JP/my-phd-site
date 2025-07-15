import type { PositionKey } from "@/types/player";

export interface Formation {
  name: string;
  positions: {
    [key in PositionKey]?: {
      top: number;
      left: number;
      max: number;
      allowed?: string[];
    };
  };
}