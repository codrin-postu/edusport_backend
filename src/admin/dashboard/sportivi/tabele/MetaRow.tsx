import * as React from 'react';
import { Select } from '../../../ui';
import { TABLES_COPY } from '../../../../club/tables/copy';
import { countLine, groupingOptions } from '../../../../club/tables/view-model';
import type { CatalogColumn, GroupKey, TableDefinition } from '../../../../club/tables/types';
import { ColumnsPopover } from './ColumnsPopover';

type Props = { definition: TableDefinition; columns: CatalogColumn[]; count: number | null; onChange: (d: TableDefinition) => void };

/** Under the bar: the row count, the grouping (absent for a type without one) and the columns (absent for the session grid). */
export function MetaRow({ definition, columns, count, onChange }: Props) {
  const grouping = groupingOptions(definition.subject);
  return (
    <div className="tbl-meta">
      <span className="tbl-count">{count === null ? '' : countLine(definition.subject, count)}</span>
      {grouping.length > 0 && (
        <Select
          value={definition.groupBy ?? ''} aria-label={TABLES_COPY.groupLabel}
          options={grouping.map((g) => ({ value: g.value ?? '', label: g.label }))}
          onChange={(v) => onChange({ ...definition, groupBy: v === '' ? null : (v as GroupKey) })}
        />
      )}
      {definition.subject !== 'sedinte' && <ColumnsPopover definition={definition} catalog={columns} onChange={onChange} />}
    </div>
  );
}
