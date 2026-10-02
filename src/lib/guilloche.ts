// Hypotrochoid rosettes and interlaced sine bands, as SVG path strings. Pure, deterministic.
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);

export function rosette(cx: number, cy: number, R: number, r: number, d: number, rot: number, n: number): string[] {
  R = Math.round(R); // gcd needs integers
  r = Math.round(r);
  const turns = (Math.PI * 2 * r) / gcd(R, r);
  return Array.from({ length: n }, (_, k) => {
    const dk = d * (0.55 + (0.45 * k) / n);
    let out = '';
    for (let t = 0; t <= turns + 0.01; t += 0.03) {
      const x = (R - r) * Math.cos(t) + dk * Math.cos(((R - r) / r) * t);
      const y = (R - r) * Math.sin(t) - dk * Math.sin(((R - r) / r) * t);
      const px = cx + x * Math.cos(rot) - y * Math.sin(rot);
      const py = cy + x * Math.sin(rot) + y * Math.cos(rot);
      out += `${out ? 'L' : 'M'}${px.toFixed(1)} ${py.toFixed(1)}`;
    }
    return out;
  });
}

export function bands(w: number, h: number, n: number, amp: number): string[] {
  return Array.from({ length: n }, (_, k) => {
    let out = '';
    for (let x = 0; x <= w; x += 6) {
      const y = h / 2 + Math.sin(x / 38 + k * 0.5) * amp * Math.cos(x / 190 + k * 0.22) + Math.sin(x / 17 - k * 0.4) * amp * 0.25;
      out += `${out ? 'L' : 'M'}${x} ${y.toFixed(1)}`;
    }
    return out;
  });
}
