/** The newest request wins: an older answer arriving late is ignored (step 3 never shows a stale preview). */
export function latestGate() {
  let last = 0;
  return {
    next: (): number => ++last,
    isLatest: (id: number): boolean => id === last,
  };
}
