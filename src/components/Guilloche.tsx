import { bands, rosette } from '@/lib/guilloche';

type Props = { w: number; h: number; stroke?: string; className?: string; kind?: 'note' | 'band' };

// Decorative engraving field. Server-rendered, no client JS.
export function Guilloche({ w, h, stroke = 'var(--foil)', className, kind = 'note' }: Props) {
  const lines =
    kind === 'band'
      ? bands(w, h, 14, h / 4)
      : [
          ...rosette(w * 0.78, h * 0.48, h * 0.4, 37, h * 0.22, 0, 14),
          ...rosette(w * 0.78, h * 0.48, h * 0.26, 25, h * 0.14, 0.4, 8),
          ...rosette(w * 0.12, h * 0.75, h * 0.3, 29, h * 0.16, 0.2, 10),
          ...bands(w, h, 9, h * 0.07),
        ];
  return (
    <svg aria-hidden className={className} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMid slice" fill="none" stroke={stroke} strokeWidth={0.6} opacity={0.5}>
      {lines.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}
