import type { RgbaImage, ScanResult } from "@/lib/omrScan";

// Loads a photo chosen by the teacher (respecting the phone's rotation) as raw pixels.
export async function loadPhoto(file: File, maxSide = 2400): Promise<{ image: RgbaImage; bitmap: ImageBitmap }> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" } as any);
  const factor = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * factor);
  const height = Math.round(bitmap.height * factor);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(bitmap, 0, 0, width, height);
  const data = ctx.getImageData(0, 0, width, height);
  return { image: { data: data.data, width, height }, bitmap };
}

// A small picture of the photo with a ring drawn on every circle the scanner thinks is filled.
export function overlayPicture(bitmap: ImageBitmap, image: RgbaImage, scan: ScanResult): string {
  const outW = Math.min(900, image.width);
  const k = outW / image.width;
  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = Math.round(image.height * k);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  ctx.lineWidth = 2;
  scan.bubbles.forEach((b) => {
    if (!b.marked) return;
    ctx.strokeStyle = b.kind === "answer" ? "#16a34a" : "#2563eb";
    ctx.beginPath();
    ctx.arc(b.x * k, b.y * k, Math.max(3, b.r * k * 1.25), 0, Math.PI * 2);
    ctx.stroke();
  });
  return canvas.toDataURL("image/jpeg", 0.7);
}
