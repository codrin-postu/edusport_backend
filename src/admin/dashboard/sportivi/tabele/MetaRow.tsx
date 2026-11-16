import * as React from 'react';
import { Input, Select } from '../../../ui';
import { TABLES_COPY } from '../../../../club/tables/copy';
import { countLine, groupingOptions } from '../../../../club/tables/view-model';
import type { CatalogColumn, GroupKey, TableDefinition } from '../../../../club/tables/types';
import { ColumnsPopover } from './ColumnsPopover';

type Props = {
  definition: TableDefinition; columns: CatalogColumn[]; count: number | null; onChange: (d: TableDefinition) => void;
  search: string; onSearch: (q: string) => void;
};

/** Under the bar: the name search, the row count, the grouping (absent for a type without one) and the columns (absent for the session grid). */
export function MetaRow({ definition, columns, count, onChange, search, onSearch }: Props) {
  const grouping = groupingOptions(definition.subject);
  return (
    <div className="tbl-meta">
      <Input className="tbl-search" type="search" value={search} placeholder={TABLES_COPY.search} aria-label={TABLES_COPY.search} onChange={(e) => onSearch(e.target.value)} />
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
