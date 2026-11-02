import * as React from 'react';
import { MenuButton } from '../SubmissionTable';

type Props = { name: string; items: { key: string; text: string; danger?: boolean }[]; onPick: (key: string) => void };

/** The "..." row menu of the money lists; nothing when there are no items. The screen loads SPORTIVI_CSS for `spv-menu`. */
export function RowMenu({ name, items, onPick }: Props) {
  const [open, setOpen] = React.useState(false);
  if (items.length === 0) return null;
  return (
    <MenuButton
      label={<><span aria-hidden="true">...</span><span className="ui-sr">{name}</span></>} open={open} onToggle={() => setOpen((o) => !o)}
      onClose={() => setOpen(false)} popClassName="spv-menu" placement="bottom-end" role="menu" chevron={false}
    >
      {items.map((i) => (
        <button key={i.key} type="button" role="menuitem" className={i.danger ? 'spv-danger' : undefined} onClick={() => { setOpen(false); onPick(i.key); }}>
          {i.text}
        </button>
      ))}
    </MenuButton>
  );
}
