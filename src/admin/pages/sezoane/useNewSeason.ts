import * as React from 'react';
import { useFetchClient } from '@strapi/admin/strapi-admin';
import type { ActionBody } from '../../../club/groups/api-types';
import { startBody, type Ticks } from '../../../club/groups/new-season/window-view';
import type { StartPreview, StartResult } from '../../../club/groups/new-season/preview';
import type { StartData } from '../../../club/groups/new-season/start-data';
import { latestGate } from '../../../club/groups/new-season/latest';

/** Routes of plan 4-3 for one target season; the preview is asked 300 ms after the last change (decided 4). */
export function useNewSeason(targetId: string) {
  const client = useFetchClient();
  const ref = React.useRef(client);
  ref.current = client;
  const base = `/api/club/seasons/${encodeURIComponent(targetId)}/start`;
  const [data, setData] = React.useState<StartData | null>(null);
  const [preview, setPreview] = React.useState<StartPreview | null>(null);
  const [failed, setFailed] = React.useState<unknown>(null);
  /** True from a tick change until the newest preview answers (success or failure). */
  const [pending, setPending] = React.useState(false);
  const gate = React.useRef(latestGate());
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  React.useEffect(() => {
    ref.current.get(base).then((r) => setData((r as { data: { data: StartData } }).data.data)).catch(setFailed);
  }, [base]);
  React.useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const refresh = React.useCallback((d: StartData, ticks: Ticks) => {
    if (timer.current) clearTimeout(timer.current);
    const id = gate.current.next();
    setPending(true);
    setFailed(null);
    timer.current = setTimeout(() => {
      ref.current.post(`${base}/preview`, startBody(d, ticks))
        .then((r) => { if (gate.current.isLatest(id)) { setPreview((r as { data: { data: StartPreview } }).data.data); setFailed(null); setPending(false); } })
        .catch((err) => { if (gate.current.isLatest(id)) { setFailed(err); setPending(false); } });
    }, 300);
  }, [base]);
  const apply = async (d: StartData, ticks: Ticks): Promise<ActionBody<StartResult>> => ((await ref.current.post(base, startBody(d, ticks))) as { data: ActionBody<StartResult> }).data;
  return { data, preview, pending, failed, refresh, apply };
}
