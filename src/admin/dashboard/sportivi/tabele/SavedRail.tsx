import * as React from 'react';
import { Button } from '../../../ui';
import { IconChevronLeft } from '../../../ui/icons';
import { MenuButton } from '../../SubmissionTable';
import { TABLES_COPY } from '../../../../club/tables/copy';
import { railMenuKeys, type RailGroup, type RailMenuKey } from '../../../../club/tables/rail';
import type { SavedViewRow } from '../../../../club/tables/types';

type Props = {
  id: string; groups: RailGroup[]; currentId: string; open: boolean; overlay: boolean;
  onPick: (id: string) => void; onClose: () => void;
  onMenu: (key: RailMenuKey, view: SavedViewRow) => void;
};

const LABEL: Record<RailMenuKey, string> = { rename: TABLES_COPY.rename, duplicate: TABLES_COPY.duplicate, remove: TABLES_COPY.remove };

function RowMenu({ view, keys, onMenu }: { view: SavedViewRow; keys: RailMenuKey[]; onMenu: Props['onMenu'] }) {
  const [open, setOpen] = React.useState(false);
  return (
    <span className="tbl-rail-menu" data-open={open}>
      <MenuButton title={TABLES_COPY.rail.menu} label="..." open={open} onToggle={() => setOpen((o) => !o)} onClose={() => setOpen(false)} popClassName="spv-menu" placement="bottom-end" role="menu" chevron={false}>
        {keys.map((key) => (
          <button key={key} type="button" role="menuitem" className={key === 'remove' ? 'spv-danger' : undefined} onClick={() => { setOpen(false); onMenu(key, view); }}>{LABEL[key]}</button>
        ))}
      </MenuButton>
    </span>
  );
}

/** "Tabele salvate": ready-made, own and colleagues' views; the open one is marked. Up to 900px wide it is a slide-over with a scrim and closes on pick. */
export function SavedRail({ id, groups, currentId, open, overlay, onPick, onMenu, onClose }: Props) {
  React.useEffect(() => {
    if (!open || !overlay) return undefined;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, overlay, onClose]);
  return (
    <>
      {open && overlay && <div className="tbl-scrim" onClick={onClose} aria-hidden="true" />}
      <aside id={id} className="ui-win tbl-rail" aria-label={TABLES_COPY.rail.title} hidden={!open}>
        <div className="tbl-rail-h">
          <h2 className="tbl-rail-title">{TABLES_COPY.rail.title}</h2>
          <Button variant="ghost" size="sm" iconOnly icon={<IconChevronLeft />} aria-label={TABLES_COPY.rail.hide} onClick={onClose} />
        </div>
        {groups.map((g) => (
          <section key={g.key} className="tbl-rail-group" aria-label={g.title}>
            <h3 className="tbl-rail-head">{g.title}</h3>
            {g.views.map((v) => {
              const keys = railMenuKeys(v);
              return (
                <div key={v.id} className="tbl-rail-row" data-current={v.id === currentId}>
                  <button type="button" className="tbl-rail-item" aria-current={v.id === currentId ? 'true' : undefined} onClick={() => { onPick(v.id); if (overlay) onClose(); }}>
                    <span className="tbl-rail-name">{v.name}</span>
                    {g.key === 'colegi' && <span className="tbl-rail-author">{v.authorName}</span>}
                  </button>
                  {keys.length > 0 && <RowMenu view={v} keys={keys} onMenu={onMenu} />}
                </div>
              );
            })}
          </section>
        ))}
      </aside>
    </>
  );
}
