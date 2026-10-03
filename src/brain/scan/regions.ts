// ponytail: connected components on a brightness threshold. Touching receipts merge into one region; upgrade to a document-scanner lib if samples fail.
export function findRegions(g: Uint8ClampedArray, w: number, h: number, minArea = 0.08 * w * h) {
  const n = g.length;
  const mean = g.reduce((a, b) => a + b, 0) / (n || 1);
  const std = Math.sqrt(g.reduce((a, b) => a + (b - mean) ** 2, 0) / (n || 1));
  if (std < 5) return [];
  const t = mean + 0.5 * std;
  const seen = new Uint8Array(n);
  const out: { x: number; y: number; w: number; h: number }[] = [];
  for (let s = 0; s < n; s++) {
    if (seen[s] || g[s] <= t) continue;
    const stack = [s];
    seen[s] = 1;
    let x0 = w, y0 = h, x1 = 0, y1 = 0, area = 0;
    while (stack.length) {
      const i = stack.pop()!;
      const x = i % w;
      const y = (i - x) / w;
      area++;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
      for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1])
        if (j >= 0 && !seen[j] && g[j] > t) {
          seen[j] = 1;
          stack.push(j);
        }
    }
    if (area >= minArea) out.push({ x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 });
  }
  return out.sort((a, b) => a.y - b.y || a.x - b.x).slice(0, 6);
}
