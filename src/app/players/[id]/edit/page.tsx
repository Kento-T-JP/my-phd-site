"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useSession, getCsrfToken } from "next-auth/react";
import { formations } from "@/data/formations";
import type { PositionKey, Roster } from "@/types/player";
import { useRouter, useParams } from "next/navigation";
import TournamentSelect from "@/components/TournamentSelect";
import useClickSound from "@/lib/useClickSound";
import { normalizeUploadImage } from "@/lib/imageUpload";
import FaceImageUploader, { defaultFaceCrop } from "@/components/FaceImageUploader";

const positionOptions: PositionKey[] = Array.from(
  new Set([
    ...formations.flatMap((f) => Object.keys(f.positions)),
    "DF",
    "MF/FW",
  ])
) as PositionKey[];

const positionGroupOrder = ["GK", "DF", "MF", "FW", "Other"] as const;
type PositionGroup = (typeof positionGroupOrder)[number];

const resolvePositionGroup = (pos: string): PositionGroup => {
  if (pos.includes("GK")) return "GK";
  if (pos.includes("DF")) return "DF";
  if (pos.includes("MF")) return "MF";
  if (pos.includes("FW")) return "FW";
  return "Other";
};

interface Affiliation {
  rosterId: number;
  tournamentName: string;
  rosterTitle: string;
}

export default function EditPlayerPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: session, status } = useSession();
  const [csrf, setCsrf] = useState("");
  const [name, setName] = useState("");
  const [positions, setPositions] = useState<PositionKey[]>([]);
  const [otherPosition, setOtherPosition] = useState("");
  const [number, setNumber] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [imageCrop, setImageCrop] = useState({ ...defaultFaceCrop });
  const [wikiUrl, setWikiUrl] = useState("");
  const [extra, setExtra] = useState<Record<string, unknown>>({});
  const [message, setMessage] = useState<string[]>([]);
  const [successMessage, setSuccessMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [tournamentName, setTournamentName] = useState("");
  const [rosterTitle, setRosterTitle] = useState("");
  const [currentAffiliations, setCurrentAffiliations] = useState<Affiliation[]>([]);
  const [rosterOptions, setRosterOptions] = useState<Affiliation[]>([]);
  const [selectedRosterIds, setSelectedRosterIds] = useState<Set<number>>(new Set());
  const [initialRosterIds, setInitialRosterIds] = useState<Set<number>>(new Set());
  const [errors, setErrors] = useState<{
    name?: string;
    position?: string;
    number?: string;
    image?: string;
    tournament?: string;
  }>({});
  const [ownerId, setOwnerId] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [actionStatus, setActionStatus] = useState<string | null>(null);
  const { play } = useClickSound();
  const deleteAudioRef = useRef<HTMLAudioElement | null>(null);
  const sessionUserId = session?.user?.id ? Number(session.user.id) : NaN;
  const isOwner = ownerId !== null && Number.isFinite(sessionUserId) && sessionUserId === ownerId;

  const prevTournament = useRef("");

  useEffect(() => {
    if (typeof window !== "undefined" && !deleteAudioRef.current) {
      const audio = new Audio("/sounds/hitonokokoro.mp3");
      audio.preload = "auto";
      deleteAudioRef.current = audio;
    }
  }, []);

  const playDeleteSound = () => {
    const audio = deleteAudioRef.current;
    if (!audio) return;
    try {
      audio.currentTime = 0;
      const result = audio.play();
      if (result && typeof result.catch === "function") {
        result.catch(() => {});
      }
    } catch {
      // ignore play errors
    }
  };

  useEffect(() => {
    async function load() {
      const [playerRes, rostersRes] = await Promise.all([
        fetch(`/api/players/${id}`),
        fetch("/api/rosters"),
      ]);
      if (playerRes.ok) {
        const p = await playerRes.json();
        setOwnerId(p.userId ?? null);
        setName(p.name);
        setPositions(p.position as PositionKey[]);
        setNumber(p.number ? String(p.number) : "");
        setWikiUrl(p.wikiUrl ?? "");
        setExtra(p.extra ?? {});
        setSelectedRosterIds(new Set());
        setInitialRosterIds(new Set());
        if (p.rosterPlayers?.length) {
          const linked = p.rosterPlayers
            .map((rp: { rosterId?: number; roster?: { tournament?: { name?: string }; title?: string } }) => {
              const rosterId = typeof rp.rosterId === "number" ? rp.rosterId : 0;
              const tournamentName = rp.roster?.tournament?.name ?? "";
              const rosterTitle = rp.roster?.title ?? "";
              return {
                rosterId,
                tournamentName,
                rosterTitle,
              } as Affiliation;
            })
            .filter(
              (rp: Affiliation) =>
                rp.rosterId > 0 &&
                rp.tournamentName.length > 0 &&
                rp.rosterTitle.length > 0
            );
          const linkedIds = new Set<number>(
            linked.map((rp: Affiliation) => rp.rosterId)
          );
          setCurrentAffiliations(linked);
          setSelectedRosterIds(new Set(linkedIds));
          setInitialRosterIds(new Set(linkedIds));
          setTournamentName("");
          setRosterTitle("");
        } else {
          setCurrentAffiliations([]);
          setSelectedRosterIds(new Set());
          setInitialRosterIds(new Set());
          setTournamentName("");
          setRosterTitle("");
        }
      }
      if (rostersRes.ok) {
        const rosters = (await rostersRes.json()) as Roster[];
        setRosterOptions(
          rosters
            .map((r) => ({
              rosterId: r.id,
              tournamentName: r.tournament?.name ?? "",
              rosterTitle: r.title,
            }))
            .filter(
              (rp: Affiliation) =>
                rp.rosterId > 0 &&
                rp.tournamentName.length > 0 &&
                rp.rosterTitle.length > 0
            )
        );
      }
      setLoading(false);
    }
    load();
  }, [id]);

  const groupedPositions = useMemo(() => {
    const groups: Record<PositionGroup, PositionKey[]> = {
      GK: [],
      DF: [],
      MF: [],
      FW: [],
      Other: [],
    };
    positionOptions.forEach((pos) => {
      const key = resolvePositionGroup(pos);
      groups[key].push(pos);
    });
    return groups;
  }, []);

  useEffect(() => {
    if (prevTournament.current && prevTournament.current !== tournamentName) {
      setRosterTitle("");
    }
    prevTournament.current = tournamentName;
  }, [tournamentName]);

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

  const togglePosition = (pos: PositionKey) => {
    setPositions((prev) =>
      prev.includes(pos) ? prev.filter((p) => p !== pos) : [...prev, pos]
    );
  };

  const toggleRosterSelection = (rosterId: number) => {
    setSelectedRosterIds((prev) => {
      const next = new Set(prev);
      if (next.has(rosterId)) {
        next.delete(rosterId);
      } else {
        next.add(rosterId);
      }
      return next;
    });
  };

  const handleDelete = async () => {
    if (isDeleting || isSubmitting) return;
    play();
    if (!confirm("削除してもよろしいですか？")) return;
    setIsDeleting(true);
    setActionStatus("選手を削除しています...");
    try {
      const res = await fetch(`/api/players/${id}`, {
        method: "DELETE",
        headers: { "X-CSRF-Token": csrf },
      });
      setErrors({});
      setMessage([]);
      setSuccessMessage("");
      if (res.ok) {
        setSuccessMessage("選手を削除しました");
        playDeleteSound();
        setTimeout(() => {
          router.push("/players");
        }, 1500);
      } else {
        const err = await res.json();
        setMessage([err.error || "選手の削除に失敗しました"]);
      }
    } catch {
      setMessage(["通信エラーが発生しました"]);
    } finally {
      setIsDeleting(false);
      setActionStatus(null);
    }
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || isDeleting) return;
    setIsSubmitting(true);
    setActionStatus("選手情報を保存しています...");
    play();
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
    initialRosterIds.forEach((rosterId) => {
      if (!selectedRosterIds.has(rosterId)) {
        form.append("removeRosterId", String(rosterId));
      }
    });
    selectedRosterIds.forEach((rosterId) => {
      if (!initialRosterIds.has(rosterId)) {
        form.append("addRosterId", String(rosterId));
      }
    });
    if (rosterTitle.trim() !== "") {
      if (tournamentName.trim() !== "") {
        form.append("tournament", tournamentName);
      }
      form.append("roster", rosterTitle);
    } else if (tournamentName.trim() !== "") {
      form.append("tournament", tournamentName);
    }

    try {
      const res = await fetch(`/api/players/${id}`, {
        method: "PUT",
        headers: { "X-CSRF-Token": csrf },
        body: form,
      });

      setErrors({});
      setMessage([]);
      setSuccessMessage("");

      if (res.ok) {
        if (tournamentName.trim() !== "") {
          window.dispatchEvent(new Event("tournament-saved"));
        }
        const msg = isOwner ? "選手情報を更新しました！" : "カスタム選手を作成しました！";
        setSuccessMessage(msg);
        setTimeout(() => {
          router.push("/players");
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
    } catch {
      setMessage(["通信エラーが発生しました"]);
    } finally {
      setIsSubmitting(false);
      setActionStatus(null);
    }
  };

  if (loading) {
    return (
      <main className="p-4 sm:p-8 max-w-md mx-auto">
        <p>Loading...</p>
      </main>
    );
  }

  return (
    <main className="p-4 sm:p-8 max-w-md mx-auto">
      <h1 className="text-xl font-bold mb-4">
        {isOwner ? "Edit Player" : "カスタム選手を作成"}
      </h1>
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
          <div className="space-y-3">
            {positionGroupOrder.map((group) => {
              const groupPositions = groupedPositions[group];
              if (groupPositions.length === 0) return null;
              return (
                <div key={group}>
                  <p className="text-xs uppercase text-white/70 mb-1">{group}</p>
                  <div className="flex flex-wrap gap-2">
                    {groupPositions.map((pos) => (
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
                </div>
              );
            })}
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
            {rosterOptions.length > 0 && (
              <div className="mb-2 rounded border border-cyan-300/30 p-2">
                <p className="text-xs text-cyan-100/90 mb-1">
                  既存ロースター（追加/解除）
                </p>
                <div className="space-y-1">
                  {rosterOptions.map((aff) => (
                    <div
                      key={aff.rosterId}
                      className="flex items-center justify-between gap-2 text-xs text-cyan-100"
                    >
                      <span>
                        {aff.tournamentName} / {aff.rosterTitle}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          play();
                          toggleRosterSelection(aff.rosterId);
                        }}
                        className={
                          selectedRosterIds.has(aff.rosterId)
                            ? "px-2 py-0.5 rounded bg-red-500 text-white"
                            : "px-2 py-0.5 rounded bg-green-500 text-white"
                        }
                      >
                        {selectedRosterIds.has(aff.rosterId) ? "解除" : "追加"}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <p className="text-xs text-cyan-100/75 mb-2">
              下の入力欄で新しい大会/ロースターを追加で紐付けできます。
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
        {Object.keys(extra).length > 0 && (
          <div>
            <button
              type="button"
              onClick={() => {
                play();
                setExpanded((prev) => !prev);
              }}
              className="flex items-center gap-1 text-blue-600"
            >
              <span>詳細</span>
              <span>{expanded ? "▲" : "▼"}</span>
            </button>
            {expanded && (
              <pre className="mt-2 whitespace-pre-wrap break-words">
                {JSON.stringify(extra, null, 2)}
              </pre>
            )}
          </div>
        )}
      {successMessage && (
        <div className="text-green-600">{successMessage}</div>
      )}
      {actionStatus && (
        <div className="text-sm text-cyan-200 animate-pulse">{actionStatus}</div>
      )}
      {message.length > 0 && (
        <div className="text-red-600">
          {message.map((m, idx) => (
            <p key={idx}>{m}</p>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <button
          type="submit"
          className="px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50"
          disabled={loading || isSubmitting || isDeleting}
        >
          {isSubmitting ? "保存中..." : isOwner ? "送信" : "カスタム作成"}
        </button>
        <button
          type="button"
          onClick={handleDelete}
          className="px-4 py-2 bg-red-500 text-white rounded disabled:opacity-50"
          disabled={isSubmitting || isDeleting}
        >
          {isDeleting ? "削除中..." : "削除"}
        </button>
      </div>
      <button
        type="button"
        onClick={() => {
          play();
          router.back();
        }}
        className="px-4 py-2 bg-gray-300 text-black rounded disabled:opacity-60"
        disabled={isSubmitting || isDeleting}
      >
        戻る
      </button>
      </form>
    </main>
  );
}
