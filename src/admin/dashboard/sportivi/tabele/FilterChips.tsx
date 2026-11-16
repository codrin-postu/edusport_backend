import * as React from 'react';
import { Button, Checkbox, Chip, Popover, Radio } from '../../../ui';
import { IconPlus } from '../../../ui/icons';
import { canAddFilter } from '../../../../club/tables/builder-state';
import type { CatalogAnswer } from '../../../../club/tables/catalog-api';
import { TABLES_COPY } from '../../../../club/tables/copy';
import { filterChipLabel, filterFields, filterValues, removeFilter, setFilterValues, valuesOf } from '../../../../club/tables/view-model';
import type { CatalogColumn, TableDefinition } from '../../../../club/tables/types';

type Props = { definition: TableDefinition; catalog: CatalogAnswer; onChange: (d: TableDefinition) => void };

type ValuesProps = { open: boolean; anchor: React.RefObject<HTMLElement | null>; options: string[]; selected: string[]; single?: boolean; label: string; onPick: (values: string[]) => void; onClose: () => void };

/** The values of one filter field as checkboxes (radios when exactly one may be chosen). */
function ValuesPopover({ open, anchor, options, selected, single = false, label, onPick, onClose }: ValuesProps) {
  return (
    <Popover open={open} anchorRef={anchor} onClose={onClose} className="tbl-pop tbl-values-pop" role="dialog" popoverProps={{ 'aria-label': label }}>
      {options.map((v) => (single
        ? <Radio key={v} name={`tbl-${label}`} value={v} label={v} checked={selected.includes(v)} onChange={() => onPick([v])} />
        : <Checkbox key={v} label={v} checked={selected.includes(v)} onChange={(on) => onPick(on ? [...selected, v] : selected.filter((x) => x !== v))} />))}
    </Popover>
  );
}

/** "Filtru": lists only the fields not used yet; picking one opens its checkbox popover, and the first tick makes the chip. */
function AddFilter({ definition, catalog, onChange, onAdded }: Props & { onAdded: (index: number) => void }) {
  const [open, setOpen] = React.useState(false);
  const [field, setField] = React.useState<CatalogColumn | null>(null);
  const anchor = React.useRef<HTMLButtonElement>(null);
  const fields = filterFields(definition.subject, definition.filters);
  const close = () => { setOpen(false); setField(null); };
  return (
    <>
      <Button ref={anchor} variant="secondary" icon={<IconPlus />} disabled={!canAddFilter(definition)} aria-haspopup="dialog" aria-expanded={open} onClick={() => (open ? close() : setOpen(true))}>
        {TABLES_COPY.filter}
      </Button>
      <Popover open={open && field === null} anchorRef={anchor} onClose={close} className="tbl-pop tbl-values-pop" role="dialog">
        {fields.map((c) => <button key={c.key} type="button" className="tbl-field" onClick={() => setField(c)}>{c.label}</button>)}
      </Popover>
      {field && (
        <ValuesPopover
          open anchor={anchor} options={valuesOf(field, catalog)} selected={[]} label={field.label} onClose={close}
          onPick={(values) => { close(); onChange(setFilterValues(definition, { column: field.key }, values)); onAdded(definition.filters.length); }}
        />
      )}
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

/** Prezență pe ședințe needs exactly one group: a chip whose popover has radios; it cannot be removed. */
function GroupPick({ definition, catalog, onChange }: Props) {
  const [open, setOpen] = React.useState(false);
  const anchor = React.useRef<HTMLButtonElement>(null);
  const { groupId } = definition.scope;
  const groups = catalog.groups.filter((g) => g.active || g.id === groupId);
  const current = groups.find((g) => g.id === groupId);
  return (
    <>
      <Chip>
        <button ref={anchor} type="button" className="tbl-chip-btn" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          {`${TABLES_COPY.group}: ${current?.name ?? TABLES_COPY.select}`}
        </button>
      </Chip>
      <ValuesPopover
        open={open} anchor={anchor} single label={TABLES_COPY.group} options={groups.map((g) => g.name)} selected={current ? [current.name] : []}
        onClose={() => setOpen(false)}
        onPick={([name]) => {
          setOpen(false);
          onChange({ ...definition, scope: { ...definition.scope, groupId: groups.find((g) => g.name === name)?.id ?? null } });
        }}
      />
    </>
  );
}

/** One set filter: the chip is a button that opens its checkbox popover; unticking the last value, or the x, removes it. */
function FilterChip({ index, definition, catalog, onChange, open, setOpen }: Props & { index: number; open: boolean; setOpen: (open: boolean) => void }) {
  const anchor = React.useRef<HTMLButtonElement>(null);
  const f = definition.filters[index];
  const column = filterFields(definition.subject, definition.filters.filter((_, i) => i !== index)).find((c) => c.key === f.column);
  return (
    <>
      <Chip removeLabel={TABLES_COPY.remove} onRemove={() => { setOpen(false); onChange(removeFilter(definition, index)); }}>
        {column ? (
          <button ref={anchor} type="button" className="tbl-chip-btn" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(!open)}>
            {filterChipLabel(definition.subject, f)}
          </button>
        ) : filterChipLabel(definition.subject, f)}
      </Chip>
      {column && (
        <ValuesPopover
          open={open} anchor={anchor} options={valuesOf(column, catalog)} selected={filterValues(f)} label={column.label} onClose={() => setOpen(false)}
          onPick={(values) => { if (values.length === 0) setOpen(false); onChange(setFilterValues(definition, f, values, index)); }}
        />
      )}
    </>
  );
}

/** The set filters as chips and the "Filtru" button (only while the type has a filter left to add). */
export function FilterChips(props: Props) {
  const { definition } = props;
  /** The chip whose values popover is open; a new filter opens its own after the first tick. */
  const [editing, setEditing] = React.useState<number | null>(null);
  if (definition.subject === 'sedinte') return <div className="tbl-bar-row"><GroupPick {...props} /></div>;
  const fields = filterFields(definition.subject, definition.filters);
  return (
    <div className="tbl-bar-row">
      {definition.filters.map((f, i) => <FilterChip key={`${f.column}${i}`} index={i} {...props} open={editing === i} setOpen={(o) => setEditing(o ? i : null)} />)}
      {scopeChips(props)}
      {fields.length > 0 && <AddFilter {...props} onAdded={setEditing} />}
    </div>
  );
}
