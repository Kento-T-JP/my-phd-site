"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewPlayerPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [position, setPosition] = useState("");
  const [number, setNumber] = useState("");
  const [image, setImage] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const data: { name: string; position: string[]; number?: number; image?: string } = {
      name,
      position: position.split(/,\s*/).filter(Boolean),
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
      setMessage(err.error || "Failed to create player");
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
          <label className="block mb-1">Position (comma separated)</label>
          <input
            className="w-full p-2 border rounded"
            value={position}
            onChange={(e) => setPosition(e.target.value)}
            required
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
        {message && <p className="text-red-600">{message}</p>}
        <button
          type="submit"
          className="px-4 py-2 bg-blue-500 text-white rounded"
        >
          Submit
        </button>
      </form>
    </main>
  );
}
