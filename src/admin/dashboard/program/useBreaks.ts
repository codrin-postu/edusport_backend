import * as React from 'react';
import { useFetchClient } from '@strapi/admin/strapi-admin';
import type { BreakDraft } from '../../../club/calendar/pauze-view';
import type { BreakRecord } from '../../../club/groups/types';
import type { BreakImpact } from '../../../club/calendar/break-impact';
import { grupeChanged } from '../grupe/undo';

const BASE = '/api/club/breaks';

/** Pauze (routes of plan 4-2). `save` and `remove` throw the server's message. */
export function useBreaks() {
  const client = useFetchClient();
  const ref = React.useRef(client);
  ref.current = client;
  const [list, setList] = React.useState<BreakRecord[] | null>(null);
  const [failed, setFailed] = React.useState(false);
  const reload = React.useCallback(async () => {
    try {
      setList(((await ref.current.get(BASE)) as { data: { data: BreakRecord[] } }).data.data);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);
  React.useEffect(() => {
    void reload();
  }, [reload]);
  const save = async (id: string | null, d: BreakDraft) => {
    await (id ? ref.current.put(`${BASE}/${encodeURIComponent(id)}`, d) : ref.current.post(BASE, d));
    await reload();
    grupeChanged();
  };
  const remove = async (id: string) => {
    await ref.current.del(`${BASE}/${encodeURIComponent(id)}`);
    await reload();
    grupeChanged();
  };
  return { list, failed, save, remove };
}

export type Breaks = ReturnType<typeof useBreaks>;

/** What a break window would cancel; null until answered, and while the dates are not valid. Debounced 300 ms. */
export function useBreakImpact(startDate: string, endDate: string, asked: boolean): { impact: BreakImpact | null; failed: boolean } {
  const client = useFetchClient();
  const ref = React.useRef(client);
  ref.current = client;
  const [state, setState] = React.useState<{ impact: BreakImpact | null; failed: boolean }>({ impact: null, failed: false });
  React.useEffect(() => {
    if (!asked) return setState({ impact: null, failed: false });
    let live = true;
    const timer = setTimeout(async () => {
      try {
        const res = (await ref.current.post(`${BASE}/impact`, { startDate, endDate })) as { data: { data: BreakImpact } };
        if (live) setState({ impact: res.data.data, failed: false });
      } catch {
        if (live) setState({ impact: null, failed: true });
      }
    }, 300);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [startDate, endDate, asked]);
  return state;
}
