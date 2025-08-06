"use client";

import { useState, useEffect, useRef } from "react";
import { formations } from "@/data/formations";
import type { PositionKey } from "@/types/player";
import { useRouter, useParams } from "next/navigation";
import TournamentSelect from "@/components/TournamentSelect";
import { rosterDisplayTitle } from "@/lib/format";

function slugify(str: string) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

const positionOptions: PositionKey[] = Array.from(
  new Set([
    ...formations.flatMap((f) => Object.keys(f.positions)),
    "DF",
    "MF/FW",
  ])
) as PositionKey[];

export default function EditPlayerPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [name, setName] = useState("");
  const [positions, setPositions] = useState<PositionKey[]>([]);
  const [otherPosition, setOtherPosition] = useState("");
  const [number, setNumber] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [wikiUrl, setWikiUrl] = useState("");
  const [message, setMessage] = useState<string[]>([]);
  const [successMessage, setSuccessMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [tournamentName, setTournamentName] = useState("");
  const [rosters, setRosters] = useState<
    { id: number; date: string; endDate?: string | null; title: string; tournament: { name: string } }[]
  >([]);
  const [rosterId, setRosterId] = useState("");
  const [errors, setErrors] = useState<{
    name?: string;
    position?: string;
    number?: string;
    image?: string;
    tournament?: string;
  }>({});

  const prevTournament = useRef("");

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/players/${id}`);
      if (res.ok) {
        const p = await res.json();
        setName(p.name);
        setPositions(p.position as PositionKey[]);
        setNumber(p.number ? String(p.number) : "");
        setWikiUrl(p.wikiUrl ?? "");
        if (p.rosterPlayers?.length) {
          const rp = p.rosterPlayers[0];
          setTournamentName(rp.roster.tournament.name);
          setRosterId(String(rp.rosterId));
        }
      }
      setLoading(false);
    }
    load();
  }, [id]);

  useEffect(() => {
    if (prevTournament.current && prevTournament.current !== tournamentName) {
      setRosterId("");
    }
    prevTournament.current = tournamentName;
    if (!tournamentName.trim()) {
      setRosters([]);
      return;
    }
    const slug = slugify(tournamentName.trim());
    const controller = new AbortController();
    fetch(`/api/rosters?slug=${encodeURIComponent(slug)}`, {
      signal: controller.signal,
    })
      .then((res) => (res.ok ? res.json() : []))
      .then((list) => {
        setRosters(list);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [tournamentName]);

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

    const form = new FormData();
    form.append("name", name);
    allPositions.forEach((p) => form.append("position", p));
    if (number.trim() !== "") form.append("number", number);
    if (image) form.append("image", image);
    if (wikiUrl.trim() !== "") form.append("wikiUrl", wikiUrl);
    if (rosterId) {
      form.append("rosterId", rosterId);
    } else if (tournamentName.trim() !== "") {
      form.append("tournament", tournamentName);
    }

    const res = await fetch(`/api/players/${id}`, {
      method: "PUT",
      body: form,
    });

    setErrors({});
    setMessage([]);
    setSuccessMessage("");

    if (res.ok) {
      if (tournamentName.trim() !== "") {
        window.dispatchEvent(new Event("tournament-saved"));
      }
      setSuccessMessage("選手情報を更新しました！");
      setTimeout(() => {
        router.push("/");
      }, 1500);
    } else {
      const err = await res.json();
      if (Array.isArray(err.error)) {
        const fieldErrors: {
          name?: string;
          position?: string;
          number?: string;
          image?: string;
          tournament?: string;
        } = {};
        err.error.forEach((e: { path: (string | number)[]; message: string }) => {
          const field = e.path[0] as keyof typeof fieldErrors;
          if (field in fieldErrors) {
            fieldErrors[field] = e.message;
          }
        });
        setErrors(fieldErrors);
      } else {
        if (typeof err.error === "string" && err.error.includes("already exists")) {
          setErrors({ name: err.error });
        } else {
          setMessage([err.error || "選手情報の更新に失敗しました"]);
        }
      }
    }
  };

  if (loading) {
    return (
      <main className="p-8 max-w-md mx-auto">
        <p>Loading...</p>
      </main>
    );
  }

  return (
    <main className="p-8 max-w-md mx-auto">
      <h1 className="text-xl font-bold mb-4">Edit Player</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block mb-1">名前</label>
          <input
            className="w-full p-2 border rounded"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          {errors.name && (
            <p className="text-red-600 text-sm mt-1">{errors.name}</p>
          )}
        </div>
        <div>
          <label className="block mb-1">ポジション</label>
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
            placeholder="その他（任意）"
            value={otherPosition}
            onChange={(e) => setOtherPosition(e.target.value)}
          />
          {errors.position && (
            <p className="text-red-600 text-sm mt-1">{errors.position}</p>
          )}
        </div>
        <div>
          <label className="block mb-1">背番号</label>
          <input
            type="number"
            min={1}
            max={99}
            className="w-full p-2 border rounded"
            value={number}
            onChange={(e) => setNumber(e.target.value)}
          />
          {errors.number && (
            <p className="text-red-600 text-sm mt-1">{errors.number}</p>
          )}
        </div>
        <div>
          <label className="block mb-1">画像（任意）</label>
          <input
            type="file"
            accept="image/*"
            className="w-full p-2 border rounded"
            onChange={(e) => setImage(e.target.files?.[0] || null)}
          />
          {errors.image && (
            <p className="text-red-600 text-sm mt-1">{errors.image}</p>
          )}
        </div>
        <div>
          <label className="block mb-1">Wikipediaリンク (任意)</label>
          <input
            type="url"
            className="w-full p-2 border rounded"
            value={wikiUrl}
            onChange={(e) => setWikiUrl(e.target.value)}
          />
        </div>
        <fieldset>
          <legend className="font-semibold mb-1">Tournament assignment</legend>
          <div className="mb-2">
            <TournamentSelect
              value={tournamentName}
              onChange={setTournamentName}
            />
            {/* Optional roster selection; leave blank to assign only tournament */}
            {rosters.length > 0 && (
              <select
                className="w-full p-2 border rounded mt-2"
                value={rosterId}
                onChange={(e) => setRosterId(e.target.value)}
              >
                <option value=""></option>
                {rosters.map((r) => (
                  <option key={r.id} value={r.id}>
                    {rosterDisplayTitle(r)}
                  </option>
                ))}
              </select>
            )}
            {errors.tournament && (
              <p className="text-red-600 text-sm mt-1">{errors.tournament}</p>
            )}
          </div>
        </fieldset>
      {successMessage && (
        <div className="text-green-600">{successMessage}</div>
      )}
      {message.length > 0 && (
        <div className="text-red-600">
          {message.map((m, idx) => (
            <p key={idx}>{m}</p>
          ))}
          </div>
        )}
        <button
          type="submit"
          className="px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50"
          disabled={loading}
        >
          送信
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="px-4 py-2 bg-gray-300 text-black rounded"
        >
          戻る
        </button>
      </form>
    </main>
  );
}
