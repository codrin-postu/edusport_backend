import * as React from 'react';
import { useFetchClient } from '@strapi/admin/strapi-admin';
import type { BreakDraft } from '../../../club/calendar/pauze-view';
import type { BreakRecord } from '../../../club/groups/types';

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
  };
  const remove = async (id: string) => {
    await ref.current.del(`${BASE}/${encodeURIComponent(id)}`);
    await reload();
  };
  return { list, failed, save, remove };
}

export type Breaks = ReturnType<typeof useBreaks>;
