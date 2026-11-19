import * as React from 'react';

const MARK = 'insDetail';

/** True when the current history entry is the one the phone detail pushed: leaving the detail should replace it, not stack on it. */
export function isPhoneDetailEntry(state: unknown): boolean {
  return typeof state === 'object' && state !== null && (state as Record<string, unknown>)[MARK] === true;
}

/**
 * Phone detail and the back gesture: opening pushes one history entry, a popstate closes the detail,
 * and the returned handler (the "back" link) goes back that one entry so history stays clean.
 * If the detail closes another way (its row vanished) the pushed entry is removed again.
 */
export function usePhoneBack(open: boolean, close: () => void): () => void {
  const pushed = React.useRef(false);
  const closeRef = React.useRef(close);
  closeRef.current = close;
  React.useEffect(() => {
    if (!open) {
      if (pushed.current) {
        pushed.current = false;
        window.history.back();
      }
      return undefined;
    }
    window.history.pushState({ ...window.history.state, [MARK]: true }, '');
    pushed.current = true;
    const onPop = () => {
      pushed.current = false;
      closeRef.current();
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [open]);
  return React.useCallback(() => {
    if (pushed.current) window.history.back();
    else closeRef.current();
  }, []);
}
