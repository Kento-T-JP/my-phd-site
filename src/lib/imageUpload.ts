export type FaceCrop = {
  zoom: number;
  offsetX: number;
  offsetY: number;
};

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

export async function normalizeUploadImage(
  file: File,
  crop?: FaceCrop
): Promise<File> {
  if (typeof window === "undefined") return file;
  if (!file.type.startsWith("image/")) return file;

  try {
    const objectUrl = URL.createObjectURL(file);
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = objectUrl;
    });

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      URL.revokeObjectURL(objectUrl);
      return file;
    }

    if (crop) {
      const zoom = clamp(crop.zoom, 1, 3);
      const offsetX = clamp(crop.offsetX, -100, 100);
      const offsetY = clamp(crop.offsetY, -100, 100);
      const srcBase = Math.min(image.naturalWidth, image.naturalHeight);
      const srcSize = Math.max(1, Math.round(srcBase / zoom));
      const maxShiftX = Math.max(0, (image.naturalWidth - srcSize) / 2);
      const maxShiftY = Math.max(0, (image.naturalHeight - srcSize) / 2);
      const srcX = Math.round(
        (image.naturalWidth - srcSize) / 2 + (offsetX / 100) * maxShiftX
      );
      const srcY = Math.round(
        (image.naturalHeight - srcSize) / 2 + (offsetY / 100) * maxShiftY
      );
      const targetSize = Math.min(1024, srcSize);
      canvas.width = targetSize;
      canvas.height = targetSize;
      ctx.drawImage(
        image,
        srcX,
        srcY,
        srcSize,
        srcSize,
        0,
        0,
        targetSize,
        targetSize
      );
    } else {
      const maxEdge = 1280;
      const scale = Math.min(
        1,
        maxEdge / Math.max(image.naturalWidth, image.naturalHeight)
      );
      const targetWidth = Math.max(1, Math.round(image.naturalWidth * scale));
      const targetHeight = Math.max(1, Math.round(image.naturalHeight * scale));
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      ctx.drawImage(image, 0, 0, targetWidth, targetHeight);
    }

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((nextBlob) => resolve(nextBlob), "image/jpeg", 0.85);
    });
    URL.revokeObjectURL(objectUrl);
    if (!blob) return file;

    const nextName = file.name.replace(/\.[a-z0-9]+$/i, ".jpg");
    return new File([blob], nextName, {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  } catch {
    return file;
  }
}
