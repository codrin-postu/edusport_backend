import * as React from 'react';
import { usePrezentaRefresh } from '../prezenta/undo';
import { useLatest } from './latest';
import { useMoneyChanged } from './undo';

/** Loads on mount, when `key` changes, and again after any money or Prezență write; a slow older answer is dropped. */
export function useLoad<T>(load: () => Promise<T>, key: string): { data: T | null; failed: boolean } {
  const [data, setData] = React.useState<T | null>(null);
  const [failed, setFailed] = React.useState(false);
  const loadRef = React.useRef(load);
  loadRef.current = load;
  const latest = useLatest();
  const reload = React.useCallback(async () => {
    const current = latest.next();
    try {
      const next = await loadRef.current();
      if (!current()) return;
      setData(next);
      setFailed(false);
    } catch {
      if (current()) setFailed(true);
    }
  }, [latest, key]);
  React.useEffect(() => {
    setData(null);
    void reload();
  }, [reload]);
  useMoneyChanged(() => void reload());
  usePrezentaRefresh(() => void reload());
  return { data, failed };
}
