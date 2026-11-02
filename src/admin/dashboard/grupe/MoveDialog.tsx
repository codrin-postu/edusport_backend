import * as React from 'react';
import { Button, Notice, SearchableSelect } from '../../ui';
import type { GroupChoice, GroupPage, MemberRow } from '../../../club/groups/api-types';
import { GROUP_ERRORS, GROUP_TOASTS, GRUPE_COPY } from '../../../club/groups/copy';
import { moveBarView } from '../../../club/bani/move-bar';
import { groupOptions, joinableGroups, wroteNothing } from '../../../club/grupe/list-view';
import { requestErrorText } from '../../../club/registration-panel';
import type { MovePreview } from '../../../club/presence/subscriptions/views';
import { AbonamentBar } from '../bani/AbonamentBar';
import { MONEY_CSS } from '../bani/styles';
import type { GrupeApi } from './api';
import { WindowShell } from './PanelShell';
import { staleToast, undoToast } from './undo';

type Props = { mode: 'move' | 'addAlso'; member: MemberRow; page: GroupPage; api: GrupeApi; onClose: () => void };

function useGroups(api: GrupeApi): { groups: GroupChoice[]; failed: boolean } {
  const [groups, setGroups] = React.useState<GroupChoice[]>([]);
  const [failed, setFailed] = React.useState(false);
  React.useEffect(() => {
    api.options().then((o) => setGroups(o.groups)).catch(() => setFailed(true));
  }, [api]);
  return { groups, failed };
}

async function apply(p: Props, to: string, groups: GroupChoice[]): Promise<void> {
  const name = groups.find((g) => g.documentId === to)?.name ?? '';
  if (p.mode === 'move') {
    const res = await p.api.move(p.member.membershipId, to);
    undoToast(GROUP_TOASTS.moved(res.data.groupName, res.data.athleteName), res.undo?.actionId ?? null, p.api);
    return;
  }
  const res = await p.api.join(to, { season: p.page.season?.label ?? '', athleteIds: [p.member.athleteId], mode: 'add' });
  if (wroteNothing(res.data)) return staleToast();
  undoToast(GROUP_TOASTS.addedAlso(name, p.member.name), res.undo?.actionId ?? null, p.api);
}

/** The abonament that would follow the athlete to the chosen group (5.12); only when moving, and only once a target is chosen. */
function useMovePreview(p: Props, to: string | null): { preview: MovePreview | null; failed: boolean } {
  const [state, setState] = React.useState<{ preview: MovePreview | null; failed: boolean }>({ preview: null, failed: false });
  const { api, mode, member } = p;
  React.useEffect(() => {
    setState({ preview: null, failed: false });
    if (mode !== 'move' || !to) return undefined;
    let off = false;
    api.movePreview(member.membershipId, to)
      .then((r) => { if (!off) setState({ preview: r, failed: false }); })
      .catch(() => { if (!off) setState({ preview: null, failed: true }); });   // shown, so "no bar" never reads as "no abonament"
    return () => { off = true; };
  }, [api, mode, member.membershipId, to]);
  return state;
}

/** The one move window (move-modal-final) and "Adaugă și în grupă" (6.2, W2, W3). */
export function MoveDialog(p: Props) {
  const { groups, failed } = useGroups(p.api);
  const [to, setTo] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const { preview, failed: previewFailed } = useMovePreview(p, to);
  const bar = moveBarView(preview);
  const submit = async () => {
    if (!to) return setError(GROUP_ERRORS.pickGroup);
    setBusy(true);
    try {
      await apply(p, to, groups);
      p.onClose();
    } catch (err) {
      setError(requestErrorText(err, GROUP_ERRORS.failed));
    } finally {
      setBusy(false);
    }
  };
  const footer = <><Button variant="ghost" onClick={p.onClose} disabled={busy}>{GRUPE_COPY.cancel}</Button><Button loading={busy} disabled={failed} onClick={() => void submit()}>{p.mode === 'move' ? GRUPE_COPY.move : GRUPE_COPY.add}</Button></>;
  return (
    <WindowShell title={p.mode === 'move' ? GRUPE_COPY.moveTitle : GRUPE_COPY.addAlsoTitle} onClose={p.onClose} footer={footer}>
      <style>{MONEY_CSS}</style>
      {(failed || previewFailed || error) && <Notice tone="danger">{failed || previewFailed ? GROUP_ERRORS.loadFailed : error}</Notice>}
      <dl className="grp-kv">
        <dt>{GRUPE_COPY.fieldAthlete}</dt><dd>{p.member.name}</dd>
        {p.mode === 'move' && <><dt>{GRUPE_COPY.fieldFrom}</dt><dd>{p.page.name}</dd></>}
        <dt>{GRUPE_COPY.fieldTo}</dt>
        <dd><SearchableSelect value={to} options={groupOptions(joinableGroups(groups, p.page.documentId, p.member.others), p.page.documentId)} aria-label={GRUPE_COPY.fieldTo} placeholder={GRUPE_COPY.pickGroup} onChange={(v) => { setTo(v); setError(null); }} /></dd>
      </dl>
      {bar.bar && <AbonamentBar bar={bar.bar} goldLine={bar.goldLine} />}
    </WindowShell>
  );
}
