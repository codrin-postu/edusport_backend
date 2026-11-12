import * as React from 'react';
import { Checkbox, Input, useDragReorder } from '../../../ui';
import { IconChevronDown, IconChevronUp, IconGrip } from '../../../ui/icons';
import { MenuButton } from '../../SubmissionTable';
import { moveColumn, toggleColumn } from '../../../../club/tables/builder-state';
import { TABLES_COPY } from '../../../../club/tables/copy';
import { MAX_COLUMNS } from '../../../../club/tables/definition';
import type { CatalogColumn, TableDefinition } from '../../../../club/tables/types';

type Props = { definition: TableDefinition; catalog: CatalogColumn[]; onChange: (d: TableDefinition) => void };

/** "Coloane (n)": search, the shown columns in order (tick to hide, drag or use the arrows to move) and the hidden ones (tick to show). */
export function ColumnsPopover({ definition, catalog, onChange }: Props) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const by = new Map(catalog.map((c) => [c.key, c] as const));
  const shown = definition.columns.flatMap((k) => { const c = by.get(k); return c ? [c] : []; });
  const hidden = catalog.filter((c) => !definition.columns.includes(c.key));
  const q = query.trim().toLocaleLowerCase('ro');
  const matches = (c: CatalogColumn): boolean => q === '' || c.label.toLocaleLowerCase('ro').includes(q);
  const searching = q !== '';
  const drag = useDragReorder({ count: shown.length, disabled: searching, onMove: (from, to) => onChange(moveColumn(definition, from, to)) });
  const last = shown.length <= 1;
  return (
    <MenuButton
      label={TABLES_COPY.columnsLabel(definition.columns.length)} open={open} popClassName="tbl-pop tbl-cols-pop"
      onToggle={() => setOpen((o) => !o)} onClose={() => { setOpen(false); setQuery(''); }}
    >
      <Input value={query} placeholder={TABLES_COPY.columnSearch} aria-label={TABLES_COPY.columnSearch} onChange={(e) => setQuery(e.target.value)} />
      <h4 className="tbl-pop-head">{TABLES_COPY.shown}</h4>
      <ul className="tbl-cols" aria-label={TABLES_COPY.shown}>
        {shown.map((c, i) => (matches(c) ? (
          <li key={c.key} className="tbl-col" data-on="true" {...(searching ? {} : drag.itemProps(i))}>
            <button type="button" className="tbl-grip ui-grip" disabled={searching} aria-label={TABLES_COPY.move(c.label)} {...(searching ? {} : drag.handleProps(i))}>
              <IconGrip />
            </button>
            <Checkbox checked label={c.label} disabled={last} onChange={() => onChange(toggleColumn(definition, c.key, false))} />
            {!searching && (
              <span className="ui-row-move">
                <button type="button" className="ui-iconbtn" aria-label={TABLES_COPY.moveUp(c.label)} disabled={i === 0} onClick={() => drag.move(i, i - 1)}><IconChevronUp /></button>
                <button type="button" className="ui-iconbtn" aria-label={TABLES_COPY.moveDown(c.label)} disabled={i === shown.length - 1} onClick={() => drag.move(i, i + 1)}><IconChevronDown /></button>
              </span>
            )}
          </li>
        ) : null))}
      </ul>
      {drag.live}
      {hidden.some(matches) && (
        <>
          <h4 className="tbl-pop-head">{TABLES_COPY.hidden}</h4>
          <ul className="tbl-cols" aria-label={TABLES_COPY.hidden}>
            {hidden.filter(matches).map((c) => (
              <li key={c.key} className="tbl-col">
                <Checkbox checked={false} label={c.label} disabled={definition.columns.length >= MAX_COLUMNS} onChange={() => onChange(toggleColumn(definition, c.key, true))} />
              </li>
            ))}
          </ul>
        </>
      )}
    </MenuButton>
  );
}
