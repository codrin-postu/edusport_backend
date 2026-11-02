import * as React from 'react';

/** One submit per click (decided 1): a second call while the first is in flight returns undefined; `busy` disables the button. */
export function useSubmitOnce<T>(work: () => Promise<T>): { run: () => Promise<T | undefined>; busy: boolean } {
  const inFlight = React.useRef(false);
  const [busy, setBusy] = React.useState(false);
  const workRef = React.useRef(work);
  workRef.current = work;
  const run = React.useCallback(async (): Promise<T | undefined> => {
    if (inFlight.current) return undefined;
    inFlight.current = true;
    setBusy(true);
    try {
      return await workRef.current();
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }, []);
  return { run, busy };
}
