"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { Session } from "next-auth";
import WikiLink from "@/components/WikiLink";
import type { Player } from "@/types/player";
import styles from "./PlayerCard.module.css";

const isLongName = (name: string) => name.replace(/\s+/g, "").length >= 5;

export interface PlayerCardProps {
  player: Player;
  isSelected?: boolean;
  onClick?: () => void;
  session?: Session | null;
  favorites: Set<number>;
  toggleFavorite: (id: number) => void;
}

export default function PlayerCard({
  player,
  isSelected = false,
  onClick,
  session,
  favorites,
  toggleFavorite,
}: PlayerCardProps) {
  const [flipped, setFlipped] = useState(false);
  const handleFlip = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    setFlipped((f) => !f);
  };

  return (
    <div
      data-testid="player-card"
      data-flipped={flipped}
      onClick={onClick}
      className={`group w-32 h-32 p-2 rounded text-center cursor-pointer transition-transform duration-200 hover:scale-105 backdrop-blur-sm border border-cyan-400/10 hover:border-cyan-400/20 bg-slate-800/50 relative ${
        isSelected ? "ring-2 ring-cyan-300" : ""
      } ${styles.card} ${flipped ? styles.flipped : ""}`}
    >
      <button
        type="button"
        aria-label={flipped ? "Show front" : "Show back"}
        onClick={handleFlip}
        className="absolute top-1 right-1 text-xs text-cyan-100"
      >
        {flipped ? "↩" : "↺"}
      </button>
      <div
        className={styles.cardFront}
        aria-hidden={flipped}
        data-testid="front"
      >
        <div className="flex flex-col items-center justify-center h-full">
          <div className="relative w-12 h-12 mx-auto">
            {player.image ? (
              <Image
                src={player.image}
                alt={player.name}
                width={48}
                height={48}
                className="w-12 h-12 object-cover rounded-full pointer-events-none"
              />
            ) : (
              <div className="w-12 h-12 flex items-center justify-center bg-gray-300/40 rounded-full pointer-events-none text-center text-xs text-cyan-100">
                No image
              </div>
            )}
          </div>
          <div
            className={`mt-1 font-semibold whitespace-normal break-words text-cyan-100 ${
              isLongName(player.name) ? "text-xs leading-tight" : ""
            } flex items-center justify-center`}
            title={player.number ? `背番号: ${player.number}` : ""}
          >
            <span>{player.name}</span>
            {session ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleFavorite(player.id);
                }}
                className="ml-1 text-yellow-300"
                aria-label={
                  favorites.has(player.id)
                    ? "Remove from favorites"
                    : "Add to favorites"
                }
              >
                {favorites.has(player.id) ? "★" : "☆"}
              </button>
            ) : (
              <Link
                href="/login"
                className="ml-1 text-yellow-300"
                aria-label="Login to favorite"
                onClick={(e) => e.stopPropagation()}
              >
                ☆
              </Link>
            )}
          </div>
        </div>
      </div>
      <div
        className={styles.cardBack}
        aria-hidden={!flipped}
        data-testid="back"
      >
        <div className="flex flex-col items-center justify-center h-full text-sm text-cyan-200 gap-1">
          {player.number && <div>背番号: {player.number}</div>}
          <div className="flex items-center gap-1">
            <span>{player.position.join(", ")}</span>
            <WikiLink
              name={player.name}
              wikiUrl={player.wikiUrl}
              variant="icon"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
