import * as React from 'react';

/**
 * Reactive `window.matchMedia(query)` wrapper.
 * Returns `true` when the query matches the current viewport.
 * SSR-safe: returns `false` until mounted.
 *
 * Example:
 *   const isNarrow = useMatchMedia('(max-width: 640px)');
 */
export function useMatchMedia(query: string): boolean {
  const [matches, setMatches] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia(query);
    const update = () => setMatches(mq.matches);
    update();
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', update);
      return () => mq.removeEventListener('change', update);
    }
    // Older Safari fallback
    mq.addListener(update);
    return () => mq.removeListener(update);
  }, [query]);

  return matches;
}
