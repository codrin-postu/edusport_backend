import * as React from 'react';
import { MenuButton } from '../SubmissionTable';
import type { MemberRow } from '../../../club/groups/api-types';
import { GRUPE_COPY } from '../../../club/groups/copy';
import { memberMenuItems, type MemberAction } from '../../../club/grupe/group-view';

/** Row "...": "Mută", "Adaugă și în grupă", "Scoate din grupă" (red) (6.2). */
export function MemberMenu({ member, busy, onPick }: { member: MemberRow; busy: boolean; onPick: (a: MemberAction, m: MemberRow) => void }) {
  const [open, setOpen] = React.useState(false);
  const label = <><span aria-hidden="true">...</span><span className="ui-sr">{GRUPE_COPY.menu}</span></>;
  return (
    <MenuButton label={label} open={open} onToggle={() => setOpen((o) => !o)} onClose={() => setOpen(false)} popClassName="spv-menu" placement="bottom-end" role="menu" chevron={false} disabled={busy}>
      {memberMenuItems().map((item) => (
        <button key={item.key} type="button" role="menuitem" className={item.danger ? 'spv-danger' : undefined} onClick={() => { setOpen(false); onPick(item.key, member); }}>
          {item.label}
        </button>
      ))}
    </MenuButton>
  );
}
