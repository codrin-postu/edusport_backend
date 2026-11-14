/**
 * Runs `work` one at a time. Calls made while a run is in flight share one follow-up run that starts when the current one ends; each caller
 * gets the result of the run that started after its call, or of the current run when none was in flight.
 */
export function coalesced<T>(work: () => Promise<T>): () => Promise<T> {
  let running: Promise<T> | null = null;
  let next: Promise<T> | null = null;
  const launch = (): Promise<T> => {
    const run = work();
    running = run;
    const clear = (): void => {
      if (running === run && !next) running = null;
    };
    run.then(clear, clear);
    return run;
  };
  return () => {
    if (!running) return launch();
    if (!next) {
      next = running.then(() => undefined, () => undefined).then(() => {
        next = null;
        return launch();
      });
    }
    return next;
  };
}
