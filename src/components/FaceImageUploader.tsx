"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { FaceCrop } from "@/lib/imageUpload";

interface Props {
  file: File | null;
  onFileChange: (file: File | null) => void;
  crop: FaceCrop;
  onCropChange: (crop: FaceCrop) => void;
}

export const defaultFaceCrop: FaceCrop = {
  zoom: 1,
  offsetX: 0,
  offsetY: 0,
};

export default function FaceImageUploader({
  file,
  onFileChange,
  crop,
  onCropChange,
}: Props) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const cropStartRef = useRef<FaceCrop | null>(null);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const disabled = !file;
  const cropLabel = useMemo(
    () => `ズーム ${crop.zoom.toFixed(2)} / X ${crop.offsetX} / Y ${crop.offsetY}`,
    [crop.zoom, crop.offsetX, crop.offsetY]
  );
  const zoom = useMemo(() => Math.max(crop.zoom, 1), [crop.zoom]);

  const startDrag = (x: number, y: number) => {
    if (disabled) return;
    dragStartRef.current = { x, y };
    cropStartRef.current = { ...crop };
  };

  const moveDrag = (x: number, y: number) => {
    if (!dragStartRef.current || !cropStartRef.current) return;
    const dx = x - dragStartRef.current.x;
    const dy = y - dragStartRef.current.y;
    const dragRange = 80 / zoom;
    const nextX = Math.max(
      -100,
      Math.min(100, cropStartRef.current.offsetX - (dx / 120) * dragRange)
    );
    const nextY = Math.max(
      -100,
      Math.min(100, cropStartRef.current.offsetY - (dy / 120) * dragRange)
    );
    onCropChange({
      ...cropStartRef.current,
      offsetX: Math.round(nextX),
      offsetY: Math.round(nextY),
    });
  };

  const endDrag = () => {
    dragStartRef.current = null;
    cropStartRef.current = null;
  };

  return (
    <div className="space-y-3">
      <input
        type="file"
        accept="image/*"
        className="w-full p-2 border rounded"
        onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
      />
      {previewUrl ? (
        <div className="rounded-md border border-cyan-300/25 bg-slate-900/35 p-3">
          <p className="text-xs text-cyan-100/75 mb-2">
            丸枠の中でドラッグして、切り取り位置を決めてください。
          </p>
          <div className="flex justify-center">
            <div
              className="h-28 w-28 rounded-full overflow-hidden border border-cyan-200/30 shadow-[0_0_0_3px_rgba(56,189,248,0.12)] cursor-move touch-none"
              onMouseDown={(e) => startDrag(e.clientX, e.clientY)}
              onMouseMove={(e) => moveDrag(e.clientX, e.clientY)}
              onMouseUp={endDrag}
              onMouseLeave={endDrag}
              onTouchStart={(e) => {
                const touch = e.touches[0];
                if (touch) startDrag(touch.clientX, touch.clientY);
              }}
              onTouchMove={(e) => {
                const touch = e.touches[0];
                if (touch) moveDrag(touch.clientX, touch.clientY);
              }}
              onTouchEnd={endDrag}
              onTouchCancel={endDrag}
            >
              <img
                src={previewUrl}
                alt="Face preview"
                className="h-full w-full object-cover select-none pointer-events-none"
                draggable={false}
                style={{
                  objectPosition: `${50 + crop.offsetX / 2}% ${50 + crop.offsetY / 2}%`,
                  transform: `scale(${crop.zoom})`,
                  transformOrigin: "center",
                }}
              />
            </div>
          </div>
          <p className="mt-2 text-[11px] text-cyan-100/65">{cropLabel}</p>
          <div className="mt-2 space-y-2">
            <label className="block text-xs text-cyan-100/80">
              Zoom
              <input
                type="range"
                min={1}
                max={3}
                step={0.01}
                value={crop.zoom}
                disabled={disabled}
                onChange={(e) =>
                  onCropChange({ ...crop, zoom: Number(e.target.value) })
                }
                className="w-full"
              />
            </label>
            <label className="block text-xs text-cyan-100/80">
              Horizontal
              <input
                type="range"
                min={-100}
                max={100}
                step={1}
                value={crop.offsetX}
                disabled={disabled}
                onChange={(e) =>
                  onCropChange({ ...crop, offsetX: Number(e.target.value) })
                }
                className="w-full"
              />
            </label>
            <label className="block text-xs text-cyan-100/80">
              Vertical
              <input
                type="range"
                min={-100}
                max={100}
                step={1}
                value={crop.offsetY}
                disabled={disabled}
                onChange={(e) =>
                  onCropChange({ ...crop, offsetY: Number(e.target.value) })
                }
                className="w-full"
              />
            </label>
          </div>
        </div>
      ) : null}
    </div>
  );
}
