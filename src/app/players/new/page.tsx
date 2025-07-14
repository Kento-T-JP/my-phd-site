"use client";

import { useState } from "react";
import { formations } from "@/data/formations";
import type { PositionKey } from "@/types/player";
import { useRouter } from "next/navigation";

const positionOptions: PositionKey[] = Array.from(
  new Set(formations.flatMap((f) => Object.keys(f.positions)))
) as PositionKey[];

export default function NewPlayerPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [positions, setPositions] = useState<PositionKey[]>([]);
  const [otherPosition, setOtherPosition] = useState("");
  const [number, setNumber] = useState("");
  const [image, setImage] = useState("");
  const [message, setMessage] = useState<string[]>([]);

  const togglePosition = (pos: PositionKey) => {
    setPositions((prev) =>
      prev.includes(pos) ? prev.filter((p) => p !== pos) : [...prev, pos]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const allPositions = otherPosition
      ? [...positions, otherPosition.trim()]
      : positions;
    const data: { name: string; position: string[]; number?: number; image?: string } = {
      name,
      position: allPositions,
    };
    if (number) data.number = parseInt(number, 10);
    if (image) data.image = image;

    const res = await fetch("/api/players", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (res.ok) {
      router.push("/");
    } else {
      const err = await res.json();
      if (Array.isArray(err.error)) {
        setMessage(err.error.map((e: { message: string }) => e.message));
      } else {
        setMessage([err.error || "Failed to create player"]);
      }
    }
  };

  return (
    <main className="p-8 max-w-md mx-auto">
      <h1 className="text-xl font-bold mb-4">Add New Player</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block mb-1">Name</label>
          <input
            className="w-full p-2 border rounded"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="block mb-1">Positions</label>
          <div className="flex flex-wrap gap-2">
            {positionOptions.map((pos) => (
              <label key={pos} className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={positions.includes(pos)}
                  onChange={() => togglePosition(pos)}
                />
                {pos}
              </label>
            ))}
          </div>
          <input
            className="w-full p-2 border rounded mt-2"
            placeholder="Other (optional)"
            value={otherPosition}
            onChange={(e) => setOtherPosition(e.target.value)}
          />
        </div>
        <div>
          <label className="block mb-1">Number</label>
          <input
            type="number"
            className="w-full p-2 border rounded"
            value={number}
            onChange={(e) => setNumber(e.target.value)}
          />
        </div>
        <div>
          <label className="block mb-1">Image URL (optional)</label>
          <input
            className="w-full p-2 border rounded"
            value={image}
            onChange={(e) => setImage(e.target.value)}
          />
        </div>
        {message.length > 0 && (
          <div className="text-red-600">
            {message.map((m, idx) => (
              <p key={idx}>{m}</p>
            ))}
          </div>
        )}
        <button
          type="submit"
          className="px-4 py-2 bg-blue-500 text-white rounded"
        >
          Submit
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="px-4 py-2 bg-gray-300 text-black rounded"
        >
          Back
        </button>
      </form>
    </main>
  );
}
