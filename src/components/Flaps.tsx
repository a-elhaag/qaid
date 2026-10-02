'use client';
import { useEffect, useRef } from 'react';

// Split-flap counter. A cell whose character changed clacks over.
export function Flaps({ value, hot = false }: { value: string; hot?: boolean }) {
  const prev = useRef(value);
  const old = [...prev.current];
  useEffect(() => {
    prev.current = value;
  }, [value]);
  return (
    <span className="flaps" dir="ltr" aria-label={value}>
      {[...value].map((c, i) => (
        <span key={i} aria-hidden className={`flap${hot ? ' hot' : ''}${old[i] !== undefined && old[i] !== c ? ' go' : ''}`}>
          {c}
        </span>
      ))}
    </span>
  );
}
