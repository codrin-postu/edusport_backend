import * as React from 'react';

/** Hands out one token per request; only the newest token is still current, so a slow older answer is dropped. `cancel` drops them all. */
export function makeLatest(): { next: () => () => boolean; cancel: () => void } {
  let n = 0;
  return {
    next: () => {
      n += 1;
      const mine = n;
      return () => mine === n;
    },
    cancel: () => { n += 1; },
  };
}

/** One `makeLatest` per component, cancelled on unmount. */
export function useLatest(): ReturnType<typeof makeLatest> {
  const ref = React.useRef<ReturnType<typeof makeLatest> | null>(null);
  if (ref.current === null) ref.current = makeLatest();
  const latest = ref.current;
  React.useEffect(() => () => latest.cancel(), [latest]);
  return latest;
}
