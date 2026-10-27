import * as React from 'react';
import { BottomSheet, Button, Loading, Notice, SearchableSelect, useIsPhone } from '../../ui';
import type { UnassignedPage, UnassignedRow } from '../../../club/groups/api-types';
import { GROUP_ERRORS, GROUP_TOASTS, GRUPE_COPY } from '../../../club/groups/copy';
import { allocateItems, groupOptions, initialPicks, type Picks } from '../../../club/grupe/list-view';
import type { GrupeApi } from './api';
import { failToast, undoToast, useGrupeRefresh } from './undo';

type Props = { api: GrupeApi; season: string; count: number };
type Loaded = { page: UnassignedPage | null; failed: boolean; picks: Picks; setPicks: (p: Picks) => void; reload: () => Promise<void> };

function useUnassigned(api: GrupeApi, season: string): Loaded {
  const [page, setPage] = React.useState<UnassignedPage | null>(null);
  const [failed, setFailed] = React.useState(false);
  const [picks, setPicks] = React.useState<Picks>({});
  const reload = React.useCallback(async () => {
    try {
      const next = await api.unassigned(season);
      setPage(next);
      setPicks((old) => ({ ...initialPicks(next.rows), ...old }));
    } catch {
      setFailed(true);
    }
  }, [api, season]);
  React.useEffect(() => {
    void reload();
  }, [reload]);
  useGrupeRefresh(() => void reload());
  return { page, failed, picks, setPicks, reload };
}

type RowProps = { row: UnassignedRow; data: Loaded; busy: boolean; onAllocate: (row: UnassignedRow) => void };

function Row({ row, data, busy, onAllocate }: RowProps) {
  const options = groupOptions(data.page?.groups ?? [], null);
  const pick = data.picks[row.athleteId] ?? null;
  return (
    <div className="grp-ua-row">
      <div>
        <span className="spv-name">{row.name}</span>
        <span className="grp-ua-src">{row.source}</span>
      </div>
      <SearchableSelect value={pick} options={options} placeholder={GRUPE_COPY.pickGroup} onChange={(v) => data.setPicks({ ...data.picks, [row.athleteId]: v })} />
      <Button size="sm" variant="secondary" loading={busy} disabled={!pick} onClick={() => onAllocate(row)}>{GRUPE_COPY.allocate}</Button>
    </div>
  );
}

function useAllocate(api: GrupeApi, season: string, data: Loaded) {
  const [busy, setBusy] = React.useState<string | null>(null);
  const run = async (key: string, work: () => Promise<void>) => {
    setBusy(key);
    try {
      await work();
    } catch (err) {
      failToast(err);
    } finally {
      setBusy(null);
    }
  };
  const groupName = (id: string) => data.page?.groups.find((g) => g.documentId === id)?.name ?? '';
  const one = (row: UnassignedRow) => void run(row.athleteId, async () => {
    const groupId = data.picks[row.athleteId] as string;
    const res = await api.join(groupId, { season, athleteIds: [row.athleteId], mode: 'allocate' });
    undoToast(GROUP_TOASTS.allocated(groupName(groupId), row.name), res.undo?.actionId ?? null, api);
  });
  const all = () => void run('all', async () => {
    const res = await api.allocate({ season, items: allocateItems(data.page?.rows ?? [], data.picks) });
    undoToast(GROUP_TOASTS.allocatedAll(res.data.allocated), res.undo?.actionId ?? null, api);
  });
  return { busy, one, all };
}

type SheetProps = { api: GrupeApi; season: string; anchorRef: React.RefObject<HTMLButtonElement | null>; onClose: () => void };

function UnassignedSheet({ api, season, anchorRef, onClose }: SheetProps) {
  const phone = useIsPhone();
  const data = useUnassigned(api, season);
  const act = useAllocate(api, season, data);
  const rows = data.page?.rows ?? [];
  const footer = (
    <Button variant={phone ? 'secondary' : 'ghost'} loading={act.busy === 'all'} disabled={!allocateItems(rows, data.picks).length} onClick={act.all}>{GRUPE_COPY.allocateAll}</Button>
  );
  const body = data.failed ? <Notice tone="danger">{GROUP_ERRORS.loadFailed}</Notice> : !data.page ? <Loading /> : (
    <div className="grp-ua">{rows.map((r) => <Row key={r.athleteId} row={r} data={data} busy={act.busy === r.athleteId} onAllocate={act.one} />)}</div>
  );
  return (
    <BottomSheet open title={GRUPE_COPY.unassignedHeader(rows.length)} desktop="dropdown" anchorRef={anchorRef} dropdownWidth={600} onClose={onClose} footer={footer}>
      {body}
    </BottomSheet>
  );
}

/** "Fără grupă" with its orange count, next to "Grupă nouă"; it belongs to the whole club and disappears at 0 (5.3). */
export function UnassignedButton({ api, season, count }: Props) {
  const anchor = React.useRef<HTMLButtonElement | null>(null);
  const [open, setOpen] = React.useState(false);
  if (count === 0) return null;
  return (
    <>
      <Button ref={anchor} variant="secondary" size="sm" className="grp-unassigned" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {GRUPE_COPY.unassigned}
        <span className="grp-count">{count}</span>
      </Button>
      {open && <UnassignedSheet api={api} season={season} anchorRef={anchor} onClose={() => setOpen(false)} />}
    </>
  );
}
