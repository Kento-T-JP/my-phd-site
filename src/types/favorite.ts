import type { Player } from "@/types/player";

export interface FavoritePlayer {
  userId: number;
  playerId: number;
  player: Player;
}
