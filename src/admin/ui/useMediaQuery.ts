import * as React from 'react';

/** Phone layout of the admin: the breakpoint Drawer, Toast and MobileNav already use. */
export const PHONE_QUERY = '(max-width: 640px)';

const media = (query: string): MediaQueryList | null =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(query) : null;

/** True while the media query matches: right on the first render, updated on every change. */
export function useMediaQuery(query: string): boolean {
  const subscribe = React.useCallback(
    (onChange: () => void) => {
      const mq = media(query);
      mq?.addEventListener('change', onChange);
      return () => mq?.removeEventListener('change', onChange);
    },
    [query],
  );
  return React.useSyncExternalStore(subscribe, () => media(query)?.matches ?? false, () => false);
}

/** True on phones (<= 640px). BottomSheet and FilterPanel switch layout on it. */
export function useIsPhone(): boolean {
  return useMediaQuery(PHONE_QUERY);
}
