import * as React from 'react';
import { cx } from './cx';
import { ensureAdminUi } from './styles';
import { Chip, ChipList } from './Chip';
import { SearchableSelect, type ComboOption } from './SearchableSelect';

/**
 * Many-to-many relation picker: the chosen entries as removable chips, a
 * SearchableSelect underneath to add one more.
 *
 *   <RelationMultiSelect
 *     value={coachIds}                       // documentIds
 *     onChange={(ids, chosen) => ...}        // documentIds + their options, in order
 *     options={team}                         // or loadOptions={(q) => search(q)}
 *     labels={{ [id]: 'Ana Pop' }}           // labels of ids not in the options yet
 *   />
 *
 * Everything is keyed by documentId, never by name: two entries with the
 * same name stay two entries. Labels are remembered per id from `options`,
 * every async answer and `labels`, so a chip keeps its name after the
 * loader's list has moved on. Already chosen entries are left out of the list.
 */

export interface RelationOption {
  documentId: string;
  label: string;
  /** Second, muted line in the list (club, role). */
  hint?: string;
}

export interface RelationMultiSelectProps {
  /** Chosen documentIds, in order. */
  value: readonly string[];
  /** The new documentIds and their options (label known for every id). */
  onChange: (documentIds: string[], chosen: RelationOption[]) => void;
  /** Static pool, filtered locally. */
  options?: readonly RelationOption[];
  /** Async pool for the typed text (debounced by SearchableSelect). Used instead of `options`. */
  loadOptions?: (query: string) => Promise<RelationOption[]>;
  /** Labels for chosen ids that are not in `options` (e.g. the entry's current relations). */
  labels?: Readonly<Record<string, string>>;
  placeholder?: string;
  emptyLabel?: string;
  disabled?: boolean;
  /** Max number of entries; the search hides once reached. */
  max?: number;
  id?: string;
  'aria-label'?: string;
  'aria-describedby'?: string;
  className?: string;
}

const toCombo = (o: RelationOption): ComboOption => ({ value: o.documentId, label: o.label, hint: o.hint });

export function RelationMultiSelect({
  value,
  onChange,
  options,
  loadOptions,
  labels,
  placeholder = 'Caută și adaugă...',
  emptyLabel,
  disabled = false,
  max,
  className,
  ...aria
}: RelationMultiSelectProps) {
  React.useInsertionEffect(() => ensureAdminUi(), []);
  // id -> option, from every source seen so far. A ref plus a version bump
  // so async answers can add to it without losing earlier entries.
  const known = React.useRef(new Map<string, RelationOption>());
  const [, bump] = React.useReducer((n: number) => n + 1, 0);

  if (labels) for (const [id, label] of Object.entries(labels)) if (!known.current.has(id)) known.current.set(id, { documentId: id, label });
  if (options) for (const o of options) known.current.set(o.documentId, o);

  const chosen = new Set(value);
  const labelOf = (id: string) => known.current.get(id)?.label || id;

  const pool = options ? options.filter((o) => !chosen.has(o.documentId)).map(toCombo) : undefined;

  const valueRef = React.useRef(value);
  valueRef.current = value;
  const loaderRef = React.useRef(loadOptions);
  loaderRef.current = loadOptions;
  // Stable loader (SearchableSelect debounces on it); the latest prop is read through the ref.
  const load = React.useCallback(async (q: string) => {
    const res = (await loaderRef.current?.(q)) ?? [];
    let added = false;
    for (const o of res) {
      if (!known.current.has(o.documentId)) added = true;
      known.current.set(o.documentId, o);
    }
    if (added) bump();
    const taken = new Set(valueRef.current);
    return res.filter((o) => !taken.has(o.documentId)).map(toCombo);
  }, []);

  const emit = (ids: string[]) => onChange(ids, ids.map((id) => known.current.get(id) ?? { documentId: id, label: id }));
  const full = max !== undefined && value.length >= max;

  return (
    <div className={cx('ui-root', 'ui-relms', className)}>
      {value.length > 0 && (
        <ChipList>
          {value.map((id) => (
            <Chip key={id} onRemove={disabled ? undefined : () => emit(value.filter((x) => x !== id))}>
              {labelOf(id)}
            </Chip>
          ))}
        </ChipList>
      )}
      {!full && (
        <SearchableSelect
          value={null}
          clearable={false}
          options={pool}
          loadOptions={loadOptions ? load : undefined}
          placeholder={placeholder}
          emptyLabel={emptyLabel}
          disabled={disabled}
          id={aria.id}
          aria-label={aria['aria-label']}
          aria-describedby={aria['aria-describedby']}
          onChange={(id, opt) => {
            if (!id || chosen.has(id)) return;
            if (opt && !known.current.has(id)) known.current.set(id, { documentId: id, label: opt.label, hint: opt.hint });
            emit([...value, id]);
          }}
        />
      )}
    </div>
  );
}

export default RelationMultiSelect;
