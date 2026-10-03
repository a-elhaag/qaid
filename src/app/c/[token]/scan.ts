import { assess, receiptBox, toGray, type Reason } from '@/brain/scan/quality';

const SMALL = 320;

/** Checks sharpness and light on a small copy, crops to the bright receipt area, and returns a 1600px JPEG. */
export async function checkAndCrop(file: File, maxSide = 1600): Promise<{ blob: Blob; ok: boolean; reason: Reason | null }> {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, SMALL / Math.max(bmp.width, bmp.height));
  const sw = Math.round(bmp.width * k);
  const sh = Math.round(bmp.height * k);
  const small = document.createElement('canvas');
  small.width = sw;
  small.height = sh;
  const sctx = small.getContext('2d', { willReadFrequently: true })!;
  sctx.drawImage(bmp, 0, 0, sw, sh);
  const gray = toGray(sctx.getImageData(0, 0, sw, sh).data);
  const verdict = assess(gray, sw, sh);

  // crop only when the box is a meaningful but not tiny part of the frame (avoid cropping to a bright logo)
  const box = receiptBox(gray, sw, sh);
  const area = (box.w * box.h) / (sw * sh);
  const crop = area > 0.25 && area < 0.95 ? { x: box.x / k, y: box.y / k, w: box.w / k, h: box.h / k } : { x: 0, y: 0, w: bmp.width, h: bmp.height };
  const out = Math.min(1, maxSide / Math.max(crop.w, crop.h));
  const c = document.createElement('canvas');
  c.width = Math.round(crop.w * out);
  c.height = Math.round(crop.h * out);
  c.getContext('2d')!.drawImage(bmp, crop.x, crop.y, crop.w, crop.h, 0, 0, c.width, c.height);
  const blob = await new Promise<Blob>((res) => c.toBlob((b) => res(b!), 'image/jpeg', 0.85));
  return { blob, ok: verdict.ok, reason: verdict.reason };
}
