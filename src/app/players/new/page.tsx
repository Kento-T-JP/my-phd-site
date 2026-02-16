"use client";

import { useState, useEffect } from "react";
import { useSession, getCsrfToken } from "next-auth/react";
import { formations } from "@/data/formations";
import type { PositionKey, Roster } from "@/types/player";
import { useRouter } from "next/navigation";
import TournamentSelect from "@/components/TournamentSelect";
import useClickSound from "@/lib/useClickSound";
import { normalizeUploadImage } from "@/lib/imageUpload";
import FaceImageUploader, { defaultFaceCrop } from "@/components/FaceImageUploader";
import { rosterDisplayTitle } from "@/lib/format";
import MultiToggleGroup from "@/components/MultiToggleGroup";

const positionOptions: PositionKey[] = Array.from(
  new Set([
    ...formations.flatMap((f) => Object.keys(f.positions)),
    "DF",
    "MF/FW",
  ])
) as PositionKey[];

export default function NewPlayerPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { play } = useClickSound();
  const [csrf, setCsrf] = useState("");
  const [name, setName] = useState("");
  const [positions, setPositions] = useState<PositionKey[]>([]);
  const [otherPosition, setOtherPosition] = useState("");
  const [number, setNumber] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [imageCrop, setImageCrop] = useState({ ...defaultFaceCrop });
  const [wikiUrl, setWikiUrl] = useState("");
  const [tournamentName, setTournamentName] = useState("");
  const [rosterTitle, setRosterTitle] = useState("");
  const [rosters, setRosters] = useState<Roster[]>([]);
  const [selectedRosterIds, setSelectedRosterIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<string | null>(null);
  const [message, setMessage] = useState<string[]>([]);
  const [successMessage, setSuccessMessage] = useState("");
  const [errors, setErrors] = useState<{
    name?: string;
    position?: string;
    number?: string;
    image?: string;
    tournament?: string;
  }>({});

  useEffect(() => {
    getCsrfToken().then((token) => setCsrf(token ?? ""));
  }, []);

  if (status === "loading") {
    return (
      <main className="p-4 sm:p-8 max-w-md mx-auto">
        <p>Loading...</p>
      </main>
    );
  }

  if (!session) {
    router.push("/login");
    return null;
  }

  useEffect(() => {
    if (!session?.user?.id) return;
    async function fetchRosters() {
      try {
        const res = await fetch("/api/rosters");
        if (!res.ok) throw new Error("Failed to fetch rosters");
        setRosters((await res.json()) as Roster[]);
      } catch (err) {
        console.error(err);
      }
    }
    fetchRosters();
  }, [session?.user?.id]);

  const togglePosition = (pos: PositionKey) => {
    setPositions((prev) =>
      prev.includes(pos) ? prev.filter((p) => p !== pos) : [...prev, pos]
    );
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    setSubmitStatus("入力内容を送信しています...");
    const allPositions = otherPosition
      ? [...positions, otherPosition.trim()]
      : positions;

    const form = new FormData();
    form.append("name", name);
    allPositions.forEach((p) => form.append("position", p));
    if (number.trim() !== "") form.append("number", number);
    if (image) {
      const normalizedImage = await normalizeUploadImage(image, imageCrop);
      form.append("image", normalizedImage);
    }
    if (wikiUrl.trim() !== "") form.append("wikiUrl", wikiUrl);
    if (selectedRosterIds.length > 0) {
      selectedRosterIds.forEach((id) => form.append("rosterId", id));
    }
    if (rosterTitle.trim() !== "") {
      if (tournamentName.trim() !== "") {
        form.append("tournament", tournamentName);
      }
      form.append("roster", rosterTitle);
    } else if (tournamentName.trim() !== "") {
      form.append("tournament", tournamentName);
    }

    try {
      const token = (await getCsrfToken()) || csrf || "";
      if (!token) {
        throw new Error("CSRFトークンを取得できませんでした。ページを再読み込みしてください。");
      }
      if (token !== csrf) {
        setCsrf(token);
      }
      const res = await fetch("/api/players", {
        method: "POST",
        headers: { "X-CSRF-Token": token },
        body: form,
      });

      setErrors({});
      setMessage([]);
      setSuccessMessage("");

      if (res.ok) {
        if (tournamentName.trim() !== "") {
          window.dispatchEvent(new Event("tournament-saved"));
        }
        setSuccessMessage("選手を登録しました！");
        setTimeout(() => {
          router.push("/home");
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
            setMessage([err.error || "選手の登録に失敗しました"]);
          }
        }
      }
    } catch {
      setMessage(["通信エラーが発生しました"]);
    } finally {
      setIsSubmitting(false);
      setSubmitStatus(null);
    }
  };

  return (
    <main className="p-4 sm:p-8 max-w-md mx-auto">
      <h1 className="text-xl font-bold mb-4">新しい選手を追加</h1>
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
          <FaceImageUploader
            file={image}
            onFileChange={(nextFile) => {
              setImage(nextFile);
              setImageCrop({ ...defaultFaceCrop });
            }}
            crop={imageCrop}
            onCropChange={setImageCrop}
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
            <MultiToggleGroup
              className="mb-2"
              legend={`既存ロースター (任意) (${selectedRosterIds.length})`}
              options={rosters.map((r) => ({
                value: String(r.id),
                label: rosterDisplayTitle(r),
              }))}
              selectedValues={selectedRosterIds}
              onChange={setSelectedRosterIds}
              emptyLabel="ロースターがありません"
            />
            <p className="mb-2 text-xs text-cyan-200">
              既存ロースターは複数選択できます。下の大会/ロースター自由入力と併用も可能です。
            </p>
            <TournamentSelect
              value={tournamentName}
              onChange={setTournamentName}
            />
            {/* Optional roster name; leave blank to assign only tournament */}
            {tournamentName.trim() !== "" && (
              <>
                <label className="block mb-1 mt-2">Roster (optional)</label>
                <input
                  data-testid="roster"
                  className="w-full p-2 border rounded"
                  value={rosterTitle}
                  onChange={(e) => setRosterTitle(e.target.value)}
                />
              </>
            )}
            {errors.tournament && (
              <p className="text-red-600 text-sm mt-1">{errors.tournament}</p>
            )}
          </div>
        </fieldset>
      {successMessage && (
        <div className="text-green-600">{successMessage}</div>
      )}
      {submitStatus && (
        <div className="text-sm text-cyan-200 animate-pulse">{submitStatus}</div>
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
          className="px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-60"
          onClick={play}
          disabled={isSubmitting}
        >
          {isSubmitting ? "登録中..." : "登録"}
        </button>
        <button
          type="button"
          onClick={() => {
            play();
            router.back();
          }}
          className="px-4 py-2 bg-gray-300 text-black rounded disabled:opacity-60"
          disabled={isSubmitting}
        >
          戻る
        </button>
      </form>
    </main>
  );
}
