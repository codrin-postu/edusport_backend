import * as React from 'react';
import { Select, type SelectOption } from '../../../ui';
import { MenuButton } from '../../SubmissionTable';
import { TABLES_COPY } from '../../../../club/tables/copy';
import { railMenuKeys, type RailGroup, type RailMenuKey } from '../../../../club/tables/rail';
import type { SavedViewRow } from '../../../../club/tables/types';

type Props = {
  groups: RailGroup[]; currentId: string; phone: boolean;
  onPick: (id: string) => void;
  onMenu: (key: RailMenuKey, view: SavedViewRow) => void;
};

const LABEL: Record<RailMenuKey, string> = { rename: TABLES_COPY.rename, duplicate: TABLES_COPY.duplicate, remove: TABLES_COPY.remove };

function RowMenu({ view, keys, onMenu }: { view: SavedViewRow; keys: RailMenuKey[]; onMenu: Props['onMenu'] }) {
  const [open, setOpen] = React.useState(false);
  return (
    <span className="tbl-rail-menu" data-open={open}>
      <MenuButton label={<span title={TABLES_COPY.rail.menu}>...</span>} open={open} onToggle={() => setOpen((o) => !o)} onClose={() => setOpen(false)} popClassName="spv-menu" placement="bottom-end" role="menu" chevron={false}>
        {keys.map((key) => (
          <button key={key} type="button" role="menuitem" className={key === 'remove' ? 'spv-danger' : undefined} onClick={() => { setOpen(false); onMenu(key, view); }}>{LABEL[key]}</button>
        ))}
      </MenuButton>
    </span>
  );
}

/** "Tabele salvate": ready-made, own and colleagues' views; the open one is marked. On a phone it is a Select "Tabel salvat". */
export function SavedRail({ groups, currentId, phone, onPick, onMenu }: Props) {
  if (phone) {
    const options: SelectOption[] = groups.flatMap((g) => g.views.map((v) => ({ value: v.id, label: v.name, group: g.title, hint: g.key === 'colegi' ? v.authorName : undefined })));
    const inList = options.some((o) => o.value === currentId);
    return (
      <div className="tbl-rail-phone">
        <span className="tbl-label" id="tbl-rail-label">{TABLES_COPY.rail.pick}</span>
        <Select value={inList ? currentId : ''} options={options} aria-labelledby="tbl-rail-label" onChange={onPick} />
      </div>
    );
  }
  return (
    <nav className="tbl-rail" aria-label={TABLES_COPY.rail.title}>
      <h2 className="tbl-rail-title">{TABLES_COPY.rail.title}</h2>
      {groups.map((g) => (
        <section key={g.key} className="tbl-rail-group" aria-label={g.title}>
          <h3 className="tbl-rail-head">{g.title}</h3>
          {g.views.map((v) => {
            const keys = railMenuKeys(v);
            return (
              <div key={v.id} className="tbl-rail-row" data-current={v.id === currentId}>
                <button type="button" className="tbl-rail-item" aria-current={v.id === currentId ? 'true' : undefined} onClick={() => onPick(v.id)}>
                  <span className="tbl-rail-name">{v.name}</span>
                  {g.key === 'colegi' && <span className="tbl-rail-author">{v.authorName}</span>}
                </button>
                {keys.length > 0 && <RowMenu view={v} keys={keys} onMenu={onMenu} />}
              </div>
            );
          })}
        </section>
      ))}
    </nav>
  );
}
