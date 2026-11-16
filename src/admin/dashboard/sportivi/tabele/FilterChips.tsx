import * as React from 'react';
import { Button, Chip, Popover, Select } from '../../../ui';
import { IconPlus } from '../../../ui/icons';
import { canAddFilter } from '../../../../club/tables/builder-state';
import type { CatalogAnswer } from '../../../../club/tables/catalog-api';
import { TABLES_COPY } from '../../../../club/tables/copy';
import { filterChipLabel, filterFields, removeFilter } from '../../../../club/tables/view-model';
import type { CatalogColumn, TableDefinition } from '../../../../club/tables/types';

type Props = { definition: TableDefinition; catalog: CatalogAnswer; onChange: (d: TableDefinition) => void };

/** The values a filter column offers: its word list, or the names of the groups and sections. */
function valuesOf(c: CatalogColumn, catalog: CatalogAnswer): string[] {
  if (c.key === 'grupa') return catalog.groups.filter((g) => g.active).map((g) => g.name);
  if (c.key === 'sectiune') return catalog.sections.map((s) => s.name);
  return c.values ?? [];
}

/** "Filtru" button: a popover with a select of values per filter column not yet used; picking one adds a chip and closes it. */
function AddFilter({ definition, catalog, onChange }: Props) {
  const [open, setOpen] = React.useState(false);
  const anchor = React.useRef<HTMLButtonElement>(null);
  const fields = filterFields(definition.subject, definition.filters);
  return (
    <>
      <Button ref={anchor} variant="secondary" icon={<IconPlus />} disabled={!canAddFilter(definition)} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {TABLES_COPY.filter}
      </Button>
      <Popover open={open} anchorRef={anchor} onClose={() => setOpen(false)} className="tbl-pop tbl-filter-pop" role="dialog">
        {fields.map((c) => (
          <label key={c.key} className="tbl-filter-field">
            <span>{c.label}</span>
            <Select
              value="" aria-label={c.label} placeholder={TABLES_COPY.select}
              options={valuesOf(c, catalog).map((v) => ({ value: v, label: v }))}
              onChange={(v) => {
                if (v === '') return;
                setOpen(false);
                onChange({ ...definition, filters: [...definition.filters, { column: c.key, op: 'eq', value: v }] });
              }}
            />
          </label>
        ))}
      </Popover>
    </>
  );
}

/** Section and group of a saved view's scope, shown as chips so nothing filters out of sight. */
function scopeChips({ definition, catalog, onChange }: Props): React.ReactNode[] {
  const { sectionId, groupId } = definition.scope;
  const set = (patch: Partial<TableDefinition['scope']>) => onChange({ ...definition, scope: { ...definition.scope, ...patch } });
  const out: React.ReactNode[] = [];
  const section = catalog.sections.find((s) => s.id === sectionId);
  const group = catalog.groups.find((g) => g.id === groupId);
  if (section) out.push(<Chip key="section" removeLabel={TABLES_COPY.remove} onRemove={() => set({ sectionId: null })}>{`Secțiune: ${section.name}`}</Chip>);
  if (group) out.push(<Chip key="group" removeLabel={TABLES_COPY.remove} onRemove={() => set({ groupId: null })}>{`Grupă: ${group.name}`}</Chip>);
  return out;
}

/** Prezență pe ședințe needs exactly one group: a select, never empty-by-choice. */
function GroupPick({ definition, catalog, onChange }: Props) {
  const { groupId } = definition.scope;
  const options = catalog.groups.filter((g) => g.active || g.id === groupId).map((g) => ({ value: g.id, label: g.name }));
  return (
    <Select
      value={groupId ?? ''} aria-label={TABLES_COPY.group} options={options} placeholder={TABLES_COPY.select}
      onChange={(v) => onChange({ ...definition, scope: { ...definition.scope, groupId: v === '' ? null : v } })}
    />
  );
}

/** The set filters as removable chips and the "Filtru" button (only while the type has a filter left to add). */
export function FilterChips(props: Props) {
  const { definition, catalog, onChange } = props;
  if (definition.subject === 'sedinte') return <div className="tbl-bar-row"><GroupPick {...props} /></div>;
  const fields = filterFields(definition.subject, definition.filters);
  return (
    <div className="tbl-bar-row">
      {definition.filters.map((f, i) => (
        <Chip key={`${f.column}${i}`} removeLabel={TABLES_COPY.remove} onRemove={() => onChange(removeFilter(definition, i))}>
          {filterChipLabel(definition.subject, f)}
        </Chip>
      ))}
      {scopeChips(props)}
      {fields.length > 0 && <AddFilter {...props} />}
    </div>
  );
}
