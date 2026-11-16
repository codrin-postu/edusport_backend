import * as React from 'react';
import { Checkbox, Input } from '../../../ui';
import { IconChevronDown, IconChevronUp } from '../../../ui/icons';
import { MenuButton } from '../../SubmissionTable';
import { checklistOrder, toggleColumn } from '../../../../club/tables/builder-state';
import { TABLES_COPY } from '../../../../club/tables/copy';
import { MAX_COLUMNS } from '../../../../club/tables/definition';
import { columnMatches, moveColumnTo } from '../../../../club/tables/rows-view';
import type { CatalogColumn, TableDefinition } from '../../../../club/tables/types';

type Props = { definition: TableDefinition; catalog: CatalogColumn[]; onChange: (d: TableDefinition) => void };

/** "Coloane (n)": search, one tick per column (shown ones first, in order) and up and down buttons on the shown ones. */
export function ColumnsPopover({ definition, catalog, onChange }: Props) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const list = checklistOrder(definition, catalog).filter((x) => columnMatches(x.column, query));
  const last = definition.columns.length <= 1;
  const shownCount = definition.columns.length;
  return (
    <MenuButton
      label={TABLES_COPY.columnsLabel(shownCount)} open={open} popClassName="tbl-pop tbl-cols-pop"
      onToggle={() => setOpen((o) => !o)} onClose={() => { setOpen(false); setQuery(''); }}
    >
      <Input value={query} placeholder={TABLES_COPY.columnSearch} aria-label={TABLES_COPY.columnSearch} onChange={(e) => setQuery(e.target.value)} />
      <ul className="tbl-cols">
        {list.map(({ column: c, on }) => {
          const i = definition.columns.indexOf(c.key);
          return (
            <li key={c.key} className="tbl-col" data-on={on}>
              <Checkbox
                checked={on} label={c.label} disabled={on ? last : shownCount >= MAX_COLUMNS}
                onChange={() => onChange(toggleColumn(definition, c.key, !on))}
              />
              {on && (
                <span className="tbl-col-move">
                  <button type="button" className="ui-iconbtn" aria-label={TABLES_COPY.moveUp} disabled={i === 0} onClick={() => onChange(moveColumnTo(definition, c.key, -1))}><IconChevronUp /></button>
                  <button type="button" className="ui-iconbtn" aria-label={TABLES_COPY.moveDown} disabled={i === shownCount - 1} onClick={() => onChange(moveColumnTo(definition, c.key, 1))}><IconChevronDown /></button>
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </MenuButton>
  );
}
