import * as React from 'react';
import { Button, Input, Select, type SelectOption } from '../../../ui';
import { IconClose } from '../../../ui/icons';
import { canAddFilter, filterText, newFilter, OPS_BY_TYPE, parseFilterText, refilter } from '../../../../club/tables/builder-state';
import { TABLES_COPY } from '../../../../club/tables/copy';
import type { CatalogColumn, FilterOp, TableDefinition, TableFilter } from '../../../../club/tables/types';

type Props = {
  definition: TableDefinition; catalog: CatalogColumn[];
  /** Names of the groups and sections, for the label columns that are data (no fixed word list). */
  names: Record<string, string[]>;
  onChange: (d: TableDefinition) => void;
};

const NO_VALUE: FilterOp[] = ['empty', 'notEmpty'];

/** The text box of a number, money, date or text value; it keeps what is typed and sends the value only when it is valid. */
function ValueBox({ column, filter, onValue }: { column: CatalogColumn; filter: TableFilter; onValue: (v: NonNullable<TableFilter['value']>) => void }) {
  const [text, setText] = React.useState(() => filterText(column, filter.value));
  const [bad, setBad] = React.useState(false);
  React.useEffect(() => { setText(filterText(column, filter.value)); setBad(false); }, [column.key, filter.op]);
  return (
    <Input
      className="tbl-val" value={text} aria-label={column.label} aria-invalid={bad || undefined}
      onChange={(e) => {
        setText(e.target.value);
        const v = parseFilterText(column, filter.op, e.target.value);
        setBad(v === null);
        if (v !== null) onValue(v);
      }}
    />
  );
}

/** One filter row: column, operator, value. A label column with a word list (or group and section names) picks the value from a list. */
function FilterRow({ filter, catalog, names, onChange, onRemove }: { filter: TableFilter; catalog: CatalogColumn[]; names: Props['names']; onChange: (f: TableFilter) => void; onRemove: () => void }) {
  const column = catalog.find((c) => c.key === filter.column) ?? catalog[0];
  const columns: SelectOption[] = catalog.map((c) => ({ value: c.key, label: c.label }));
  const ops: SelectOption[] = OPS_BY_TYPE[column.type].map((op) => ({ value: op, label: TABLES_COPY.ops[op] }));
  const words = column.type === 'label' ? column.values ?? names[column.key] ?? null : null;
  const single = filter.op === 'eq' && words !== null && typeof filter.value === 'string';
  return (
    <div className="tbl-filter">
      <Select value={column.key} options={columns} aria-label={TABLES_COPY.filters} onChange={(key) => onChange(refilter(filter, catalog.find((c) => c.key === key) ?? column, 'notEmpty'))} />
      <Select value={filter.op} options={ops} aria-label={column.label} onChange={(op) => onChange(refilter(filter, column, op as FilterOp))} />
      {!NO_VALUE.includes(filter.op) && single && (
        <Select value={filter.value as string} options={(words ?? []).map((w) => ({ value: w, label: w }))} aria-label={column.label} onChange={(w) => onChange({ ...filter, value: w })} />
      )}
      {!NO_VALUE.includes(filter.op) && !single && <ValueBox column={column} filter={filter} onValue={(value) => onChange({ ...filter, value })} />}
      <Button variant="ghost" size="sm" iconOnly icon={<IconClose />} aria-label={TABLES_COPY.remove} onClick={onRemove} />
    </div>
  );
}

/** "Filtre" with "+ filtru" (at most 10). */
export function FilterList({ definition, catalog, names, onChange }: Props) {
  const set = (i: number, f: TableFilter) => onChange({ ...definition, filters: definition.filters.map((x, j) => (j === i ? f : x)) });
  return (
    <div className="tbl-filters">
      {definition.filters.map((f, i) => (
        <FilterRow
          key={i} filter={f} catalog={catalog} names={names} onChange={(next) => set(i, next)}
          onRemove={() => onChange({ ...definition, filters: definition.filters.filter((_, j) => j !== i) })}
        />
      ))}
      <div>
        <Button variant="secondary" size="sm" disabled={!canAddFilter(definition)} onClick={() => onChange({ ...definition, filters: [...definition.filters, newFilter(catalog)] })}>
          {TABLES_COPY.addFilter}
        </Button>
      </div>
    </div>
  );
}
