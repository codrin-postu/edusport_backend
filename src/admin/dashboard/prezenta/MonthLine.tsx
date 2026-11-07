import * as React from 'react';
import { PREZENTA_COPY } from '../../../club/presence/copy/prezenta-ui';
import { addMonths, monthTitle } from '../../../club/presence/dates';
import { usePrezentaApi, type PrezentaApi } from './api';
import { HeaderSlot, Switcher } from './Switcher';
import { useLatest } from '../bani/latest';
import { usePrezentaRefresh } from './undo';

type MonthLineProps = { month: string; onMonth: (month: string) => void; action?: React.ReactNode; host?: HTMLElement | null };

/** "<" month ">" and the tab's action: in the page header (host) or, on the group page, in a bar of its own. */
export function MonthLine({ month, onMonth, action, host }: MonthLineProps) {
  return (
    <HeaderSlot host={host}>
      <Switcher
        label={PREZENTA_COPY.monthLabel} prevLabel={PREZENTA_COPY.prevMonth} nextLabel={PREZENTA_COPY.nextMonth}
        onPrev={() => onMonth(addMonths(month, -1))} onNext={() => onMonth(addMonths(month, 1))} middle={monthTitle(month)} middleOn
      />
      {action}
    </HeaderSlot>
  );
}

/** Loads a month list and reloads after any Prezență write. */
export function useMonthLoad<T>(load: (api: PrezentaApi, month: string) => Promise<T>, month: string): { data: T | null; failed: boolean } {
  const api = usePrezentaApi();
  const [data, setData] = React.useState<T | null>(null);
  const [failed, setFailed] = React.useState(false);
  const loadRef = React.useRef(load);
  loadRef.current = load;
  const latest = useLatest();
  const reload = React.useCallback(async () => {
    const current = latest.next();
    try {
      const next = await loadRef.current(api, month);
      if (!current()) return;
      setData(next);
      setFailed(false);
    } catch {
      if (current()) setFailed(true);
    }
  }, [api, latest, month]);
  React.useEffect(() => {
    setData(null);
    void reload();
  }, [reload]);
  usePrezentaRefresh(() => void reload());
  return { data, failed };
}

/** The same load for a period: the key is "from|to". */
export function usePeriodLoad<T>(load: (api: PrezentaApi, from: string, to: string) => Promise<T>, period: { from: string; to: string }): { data: T | null; failed: boolean } {
  return useMonthLoad((api, key) => {
    const [from, to] = key.split('|');
    return load(api, from, to);
  }, `${period.from}|${period.to}`);
}
