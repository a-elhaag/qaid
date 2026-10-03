import { describe, expect, it } from 'vitest';
import { findRegions } from './regions';

const img = (w: number, h: number, rects: [number, number, number, number][]) => {
  const a = new Uint8ClampedArray(w * h).fill(20);
  for (const [x0, y0, rw, rh] of rects) for (let y = y0; y < y0 + rh; y++) for (let x = x0; x < x0 + rw; x++) a[y * w + x] = 230;
  return a;
};

describe('findRegions', () => {
  it('finds two separate receipts, left to right', () => {
    const r = findRegions(img(100, 60, [[5, 5, 30, 50], [60, 5, 30, 50]]), 100, 60);
    expect(r).toEqual([{ x: 5, y: 5, w: 30, h: 50 }, { x: 60, y: 5, w: 30, h: 50 }]);
  });
  it('one receipt gives one region', () => {
    expect(findRegions(img(100, 60, [[20, 5, 50, 50]]), 100, 60)).toHaveLength(1);
  });
  it('ignores specks below the minimum area', () => {
    expect(findRegions(img(100, 60, [[20, 5, 50, 50], [2, 2, 3, 3]]), 100, 60)).toHaveLength(1);
  });
  it('uniform image returns no regions', () => {
    expect(findRegions(new Uint8ClampedArray(100 * 60).fill(100), 100, 60)).toEqual([]);
  });
});
