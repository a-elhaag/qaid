const BLUR_MIN = 60;
const DARK_MAX = 45;
const BRIGHT_MIN = 245;

export function toGray(rgba: Uint8ClampedArray): Uint8ClampedArray {
  const g = new Uint8ClampedArray(rgba.length / 4);
  for (let i = 0; i < g.length; i++) g[i] = 0.299 * rgba[i * 4] + 0.587 * rgba[i * 4 + 1] + 0.114 * rgba[i * 4 + 2];
  return g;
}

export const brightness = (g: Uint8ClampedArray) => g.reduce((a, b) => a + b, 0) / (g.length || 1);

/** Variance of the 4-neighbour Laplacian. Higher is sharper. */
export function blurScore(g: Uint8ClampedArray, w: number, h: number): number {
  const vals: number[] = [];
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      vals.push(g[i - 1] + g[i + 1] + g[i - w] + g[i + w] - 4 * g[i]);
    }
  const mean = vals.reduce((a, b) => a + b, 0) / (vals.length || 1);
  return vals.reduce((a, b) => a + (b - mean) ** 2, 0) / (vals.length || 1);
}

export type Reason = 'blurry' | 'dark' | 'bright';

export function assess(g: Uint8ClampedArray, w: number, h: number): { ok: boolean; reason: Reason | null } {
  const b = brightness(g);
  if (b < DARK_MAX) return { ok: false, reason: 'dark' };
  if (b > BRIGHT_MIN) return { ok: false, reason: 'bright' };
  if (blurScore(g, w, h) < BLUR_MIN) return { ok: false, reason: 'blurry' };
  return { ok: true, reason: null };
}

// ponytail: bounding box of "bright" pixels, not true perspective correction. Upgrade to a document-scanner lib if samples fail.
export function receiptBox(g: Uint8ClampedArray, w: number, h: number) {
  const mean = brightness(g);
  const std = Math.sqrt(g.reduce((a, b) => a + (b - mean) ** 2, 0) / (g.length || 1));
  if (std < 5) return { x: 0, y: 0, w, h };
  const t = mean + 0.5 * std;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (g[y * w + x] > t) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  return x1 < 0 ? { x: 0, y: 0, w, h } : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}
