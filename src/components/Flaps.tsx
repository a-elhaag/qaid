'use client';
import { useState } from 'react';

// Split-flap counter. A cell whose character changed clacks over.
export function Flaps({ value, hot = false }: { value: string; hot?: boolean }) {
  // derived state from the previous render (React's pattern for "previous value", no ref reads during render)
  const [shown, setShown] = useState(value);
  const [old, setOld] = useState(value);
  if (value !== shown) {
    setOld(shown);
    setShown(value);
  }
  const before = [...old];
  return (
    <span className="flaps" dir="ltr" aria-label={value}>
      {[...value].map((c, i) => {
        const changed = before[i] !== undefined && before[i] !== c;
        // a changed cell gets a new key, so its animation restarts every time
        return (
          <span key={changed ? `${i}-${c}` : i} aria-hidden className={`flap${hot ? ' hot' : ''}${changed ? ' go' : ''}`}>
            {c}
          </span>
        );
      })}
    </span>
  );
}
