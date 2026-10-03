import { describe, expect, it } from 'vitest';
import { assess, blurScore, brightness, receiptBox } from './quality';

const img = (w: number, h: number, f: (x: number, y: number) => number) => {
  const a = new Uint8ClampedArray(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) a[y * w + x] = f(x, y);
  return a;
};

describe('blurScore', () => {
  it('sharp checkerboard scores higher than flat', () => {
    const sharp = img(32, 32, (x, y) => ((x + y) % 2 ? 255 : 0));
    const flat = img(32, 32, () => 128);
    expect(blurScore(sharp, 32, 32)).toBeGreaterThan(blurScore(flat, 32, 32));
    expect(blurScore(flat, 32, 32)).toBe(0);
  });
});

describe('assess', () => {
  it('flags dark, bright and blurry; passes a good image', () => {
    expect(assess(img(32, 32, () => 10), 32, 32).reason).toBe('dark');
    expect(assess(img(32, 32, () => 255), 32, 32).reason).toBe('bright');
    expect(assess(img(32, 32, (x) => 100 + (x % 2)), 32, 32).reason).toBe('blurry');
    expect(assess(img(32, 32, (x, y) => ((x + y) % 2 ? 200 : 60)), 32, 32)).toEqual({ ok: true, reason: null });
  });
});

describe('brightness', () => {
  it('is the mean', () => expect(brightness(new Uint8ClampedArray([0, 100, 200]))).toBe(100));
});

describe('receiptBox', () => {
  it('finds the bright block on a dark background', () => {
    const g = img(40, 40, (x, y) => (x >= 10 && x < 30 && y >= 5 && y < 35 ? 230 : 20));
    expect(receiptBox(g, 40, 40)).toEqual({ x: 10, y: 5, w: 20, h: 30 });
  });
  it('uniform image falls back to the full frame', () => {
    expect(receiptBox(img(10, 10, () => 100), 10, 10)).toEqual({ x: 0, y: 0, w: 10, h: 10 });
  });
});
