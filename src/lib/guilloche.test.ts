import { describe, expect, it } from 'vitest';
import { bands, rosette } from './guilloche';

describe('guilloche', () => {
  it('makes n closed-ish rosette paths, deterministic', () => {
    const a = rosette(100, 100, 50, 11, 30, 0, 4);
    expect(a).toHaveLength(4);
    expect(a[0].startsWith('M')).toBe(true);
    expect(rosette(100, 100, 50, 11, 30, 0, 4)).toEqual(a);
  });
  it('makes n bands spanning the width', () => {
    const b = bands(120, 40, 3, 10);
    expect(b).toHaveLength(3);
    expect(b[0]).toContain('M0 ');
    expect(b[0]).toMatch(/L120 /);
  });
});

it('survives fractional radii', () => {
  expect(rosette(0, 0, 161.2, 25, 10, 0, 2)).toHaveLength(2);
});
