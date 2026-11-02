import * as React from 'react';

/** One call at a time: a second call while the first is in flight returns undefined and does not start `work`. `onBusy` follows the flag. */
export async function runOnce<T>(flag: { current: boolean }, work: () => Promise<T>, onBusy: (busy: boolean) => void): Promise<T | undefined> {
  if (flag.current) return undefined;
  flag.current = true;
  onBusy(true);
  try {
    return await work();
  } finally {
    flag.current = false;
    onBusy(false);
  }
}

/** One submit per click (decided 1): a second call while the first is in flight returns undefined; `busy` disables the button. */
export function useSubmitOnce<T>(work: () => Promise<T>): { run: () => Promise<T | undefined>; busy: boolean } {
  const inFlight = React.useRef(false);
  const [busy, setBusy] = React.useState(false);
  const workRef = React.useRef(work);
  workRef.current = work;
  const run = React.useCallback((): Promise<T | undefined> => runOnce(inFlight, () => workRef.current(), setBusy), []);
  return { run, busy };
}
