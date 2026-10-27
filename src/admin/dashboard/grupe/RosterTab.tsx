import * as React from 'react';
import { Link } from 'react-router-dom';
import { EmptyState, useIsPhone } from '../../ui';
import type { GroupPage, MemberRow } from '../../../club/groups/api-types';
import { GROUP_TOASTS, GRUPE_COPY, athletesText } from '../../../club/groups/copy';
import { ageText, mainText, othersText, phoneMemberLine, type MemberAction } from '../../../club/grupe/group-view';
import { writable } from '../../../club/grupe/list-view';
import { athleteRecordTo } from '../../../club/sportivi/routes';
import type { GrupeApi } from './api';
import { AddMembers } from './AddMembers';
import { MemberMenu } from './MemberMenu';
import { MoveDialog } from './MoveDialog';
import { failToast, undoToast } from './undo';

type Pick = (a: MemberAction, m: MemberRow) => void;
type ListProps = { page: GroupPage; can: boolean; busy: string | null; onPick: Pick };
const muted = (text: string) => <span className="spv-muted">{text}</span>;

function MemberTable({ page, can, busy, onPick }: ListProps) {
  return (
    <table className="ui-table">
      <thead>
        <tr><th scope="col">{GRUPE_COPY.colAthlete}</th><th scope="col">{GRUPE_COPY.colAge}</th><th scope="col">{GRUPE_COPY.colMain}</th><th scope="col">{GRUPE_COPY.colOthers}</th><th scope="col"><span className="ui-sr">{GRUPE_COPY.menu}</span></th></tr>
      </thead>
      <tbody>
        {page.members.map((m) => (
          <tr key={m.membershipId}>
            <td><Link className="spv-name" to={athleteRecordTo(m.athleteId)}>{m.name}</Link></td>
            <td>{ageText(m.age)}</td>
            <td>{m.isMain ? mainText(m) : muted(mainText(m))}</td>
            <td>{othersText(m) ?? muted(GRUPE_COPY.none)}</td>
            <td>{can && <MemberMenu member={m} busy={busy === m.membershipId} onPick={onPick} />}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function MemberCards({ page, can, busy, onPick }: ListProps) {
  return (
    <ul className="spv-cards">
      {page.members.map((m) => (
        <li key={m.membershipId} className="spv-card">
          <Link className="spv-name" to={athleteRecordTo(m.athleteId)}>{m.name}</Link>
          <span>{phoneMemberLine(m)}</span>
          {can && <MemberMenu member={m} busy={busy === m.membershipId} onPick={onPick} />}
        </li>
      ))}
    </ul>
  );
}

function useRemove(page: GroupPage, api: GrupeApi) {
  const [busy, setBusy] = React.useState<string | null>(null);
  const remove = async (m: MemberRow) => {
    setBusy(m.membershipId);
    try {
      const res = await api.removeMember(m.membershipId);
      undoToast(GROUP_TOASTS.removed(page.name, m.name), res.undo?.actionId ?? null, api);
    } catch (err) {
      failToast(err);
    } finally {
      setBusy(null);
    }
  };
  return { busy, remove };
}

/** Sportivi tab (6.2): the bar, the roster, the row menu and its windows. */
export function RosterTab({ page, api }: { page: GroupPage; api: GrupeApi }) {
  const phone = useIsPhone();
  const can = writable(page);
  const { busy, remove } = useRemove(page, api);
  const [dialog, setDialog] = React.useState<{ mode: 'move' | 'addAlso'; member: MemberRow } | null>(null);
  const onPick: Pick = (a, m) => (a === 'remove' ? void remove(m) : setDialog({ mode: a, member: m }));
  const list = phone ? <MemberCards page={page} can={can} busy={busy} onPick={onPick} /> : <MemberTable page={page} can={can} busy={busy} onPick={onPick} />;
  return (
    <div className="ui-body">
      <div className="grp-bar"><span>{athletesText(page.members.length)}</span>{can && <AddMembers page={page} api={api} />}</div>
      {page.members.length ? list : <EmptyState>{athletesText(0)}</EmptyState>}
      {dialog && <MoveDialog mode={dialog.mode} member={dialog.member} page={page} api={api} onClose={() => setDialog(null)} />}
    </div>
  );
}
