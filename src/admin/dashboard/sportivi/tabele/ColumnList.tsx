import * as React from 'react';
import { Checkbox, useDragReorder } from '../../../ui';
import { IconChevronDown, IconChevronUp, IconGrip } from '../../../ui/icons';
import { checklistOrder, moveColumn, toggleColumn } from '../../../../club/tables/builder-state';
import { TABLES_COPY } from '../../../../club/tables/copy';
import type { CatalogColumn, TableDefinition } from '../../../../club/tables/types';

type Props = { definition: TableDefinition; catalog: CatalogColumn[]; onChange: (d: TableDefinition) => void };

/** "Coloane, în ordine": every catalog column as a checkbox, the chosen ones first, draggable (and movable with buttons or the keyboard). */
export function ColumnList({ definition, catalog, onChange }: Props) {
  const rows = checklistOrder(definition, catalog);
  const chosen = definition.columns.length;
  const drag = useDragReorder({ count: chosen, onMove: (from, to) => onChange(moveColumn(definition, from, to)) });
  return (
    <>
      <ul className="tbl-cols" aria-label={TABLES_COPY.columns}>
        {rows.map(({ column, on }, i) => (
          <li key={column.key} className="tbl-col" data-on={on} {...(on ? drag.itemProps(i) : {})}>
            <button type="button" className="tbl-grip ui-grip" disabled={!on} aria-label={TABLES_COPY.move(column.label)} tabIndex={on ? 0 : -1} {...(on ? drag.handleProps(i) : {})}>
              <IconGrip />
            </button>
            <Checkbox
              checked={on} label={column.label} disabled={on && chosen <= 1}
              onChange={(next) => onChange(toggleColumn(definition, column.key, next))}
            />
            {on && (
              <span className="ui-row-move">
                <button type="button" className="ui-iconbtn" aria-label={TABLES_COPY.moveUp(column.label)} disabled={i === 0} onClick={() => drag.move(i, i - 1)}><IconChevronUp /></button>
                <button type="button" className="ui-iconbtn" aria-label={TABLES_COPY.moveDown(column.label)} disabled={i === chosen - 1} onClick={() => drag.move(i, i + 1)}><IconChevronDown /></button>
              </span>
            )}
          </li>
        ))}
      </ul>
      {drag.live}
    </>
  );
}
