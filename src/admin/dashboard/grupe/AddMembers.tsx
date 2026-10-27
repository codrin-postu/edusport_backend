import * as React from 'react';
import { BottomSheet, Button, Checkbox, Input, Switch } from '../../ui';
import { IconPlus } from '../../ui/icons';
import type { GroupPage } from '../../../club/groups/api-types';
import { GROUP_TOASTS, GRUPE_COPY } from '../../../club/groups/copy';
import { addCandidates } from '../../../club/grupe/group-view';
import type { GrupeApi } from './api';
import { failToast, undoToast } from './undo';

type Candidate = { athleteId: string; name: string; source: string };

/** Off: the "Fără grupă" rows of the season; on: the athlete search (two letters at least) (decided 3). */
function useCandidates(api: GrupeApi, page: GroupPage, all: boolean, q: string): Candidate[] {
  const [rows, setRows] = React.useState<Candidate[]>([]);
  React.useEffect(() => {
    let off = false;
    const load = all
      ? q.trim().length >= 2 ? api.searchAthletes(q).then((cards) => cards.map((c) => ({ athleteId: c.documentId, name: c.name, source: c.lastGroup?.name ?? '' }))) : Promise.resolve([])
      : api.unassigned(page.season?.label ?? null).then((p) => p.rows.map((r) => ({ athleteId: r.athleteId, name: r.name, source: r.source })));
    load.then((list) => { if (!off) setRows(addCandidates(list, page.members)); }).catch(() => { if (!off) setRows([]); });
    return () => { off = true; };
  }, [api, page, all, q]);
  return rows;
}

function Picker({ rows, ticked, toggle }: { rows: Candidate[]; ticked: Set<string>; toggle: (id: string) => void }) {
  return (
    <div className="grp-pick">
      {rows.map((r) => (
        <Checkbox key={r.athleteId} checked={ticked.has(r.athleteId)} onChange={() => toggle(r.athleteId)} label={<span><span className="spv-name">{r.name}</span> <span className="grp-ua-src">{r.source}</span></span>} />
      ))}
    </div>
  );
}

type SheetProps = {
  rows: Candidate[]; all: boolean; setAll: (v: boolean) => void; q: string; setQ: (v: string) => void;
  ticked: Set<string>; toggle: (id: string) => void; footer: React.ReactNode; anchor: React.RefObject<HTMLButtonElement | null>; onClose: () => void;
};

function AddSheet(p: SheetProps) {
  return (
    <BottomSheet open title={GRUPE_COPY.addMembersTitle} desktop="dropdown" anchorRef={p.anchor} dropdownWidth={460} onClose={p.onClose} footer={p.footer}>
      <Switch checked={p.all} onChange={p.setAll} label={GRUPE_COPY.allAthletes} />
      {p.all && <Input type="search" value={p.q} placeholder={GRUPE_COPY.searchAthletes} aria-label={GRUPE_COPY.searchAthletes} onChange={(e) => p.setQ(e.target.value)} />}
      <Picker rows={p.rows} ticked={p.ticked} toggle={p.toggle} />
    </BottomSheet>
  );
}

/** "Adaugă sportivi" (6.2, W3): tick several; each becomes main when it has no group this season; Inactiv becomes Activ. */
export function AddMembers({ page, api }: { page: GroupPage; api: GrupeApi }) {
  const anchor = React.useRef<HTMLButtonElement | null>(null);
  const [open, setOpen] = React.useState(false);
  const [all, setAll] = React.useState(false);
  const [q, setQ] = React.useState('');
  const [ticked, setTicked] = React.useState<Set<string>>(new Set());
  const [busy, setBusy] = React.useState(false);
  const rows = useCandidates(api, page, all, q);
  const toggle = (id: string) => setTicked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const submit = async () => {
    setBusy(true);
    try {
      const res = await api.join(page.documentId, { season: page.season?.label ?? '', athleteIds: [...ticked], mode: 'add' });
      undoToast(GROUP_TOASTS.added(res.data.added), res.undo?.actionId ?? null, api);
      setOpen(false);
      setTicked(new Set());
    } catch (err) {
      failToast(err);
    } finally {
      setBusy(false);
    }
  };
  const footer = <Button loading={busy} disabled={!ticked.size} onClick={() => void submit()}>{GRUPE_COPY.addToGroup}</Button>;
  return (
    <>
      <Button ref={anchor} variant="secondary" size="sm" icon={<IconPlus />} onClick={() => setOpen((o) => !o)}>{GRUPE_COPY.addMembers}</Button>
      {open && <AddSheet rows={rows} all={all} setAll={setAll} q={q} setQ={setQ} ticked={ticked} toggle={toggle} footer={footer} anchor={anchor} onClose={() => setOpen(false)} />}
    </>
  );
}
