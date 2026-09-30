import * as React from 'react';
import { cx } from './cx';
import { ensureAdminUi } from './styles';
import { AddButton } from './AddButton';
import { ExpandableRow } from './ExpandableRow';
import { useDragReorder, moveItem } from './useDragReorder';
import { IconChevronDown, IconChevronUp, IconGrip, IconTrash } from './icons';
import { ConfirmDialog } from '../ConfirmDialog';

/**
 * Generic list of editable items: rules, pricing tiers, schedule groups,
 * help ways, participants. One component for the 6 list editors in the
 * component-preview plugin.
 *
 *   <RepeatableList
 *     items={rules}
 *     onChange={setRules}
 *     getKey={(r) => r.id}
 *     newItem={() => ({ id: uid(), label: '', text: '' })}
 *     addLabel="Adaugă regulă"
 *     reorder expandable confirmDelete
 *     renderSummary={(r) => r.label || 'Regulă nouă'}
 *     renderRow={(r, i, { update }) => <Input value={r.label} onChange={(e) => update({ label: e.target.value })} />}
 *   />
 *
 * Options: `reorder` (drag handle, arrow keys on the handle, Alt+ArrowUp /
 * ArrowDown inside a row, up / down buttons on touch screens), `expandable`
 * (collapsed summary rows, new rows open), `confirmDelete` (true or a message:
 * ConfirmDialog before removing), `maxItems` (the add button turns off).
 * Expanded state is keyed by getKey, so it survives a reorder.
 */

export interface RepeatableRowApi<T> {
  index: number;
  /** Merge fields into an object item (or replace a primitive item). */
  update: (patch: Partial<T> | ((cur: T) => T)) => void;
  /** Remove the item (asks first when confirmDelete is set). */
  remove: () => void;
  expanded: boolean;
  toggle: () => void;
  moveUp: () => void;
  moveDown: () => void;
}

export interface RepeatableListProps<T> {
  items: readonly T[];
  onChange: (items: T[]) => void;
  getKey: (item: T, index: number) => string | number;
  renderRow: (item: T, index: number, api: RepeatableRowApi<T>) => React.ReactNode;
  /** The collapsed row (expandable mode). Default "Element n". */
  renderSummary?: (item: T, index: number) => React.ReactNode;
  /** Short name for aria labels and the delete question, e.g. "regula 2". Default "elementul n". */
  itemLabel?: (item: T, index: number) => string;
  /** Factory for a new item; the list appends it. */
  newItem?: () => T;
  /** Custom add (e.g. opens a picker); used instead of newItem. */
  onAdd?: () => void;
  /** Text of the full-width add button. Default "Adaugă". */
  addLabel?: string;
  /** Shown instead of the list when there are no items. */
  emptyLabel?: React.ReactNode;
  reorder?: boolean;
  expandable?: boolean;
  /** Keys expanded on first render (expandable mode). */
  defaultExpanded?: Array<string | number>;
  /** true, or the question to ask, or full dialog copy. */
  confirmDelete?: boolean | string | { title?: string; message: string; detail?: string };
  maxItems?: number;
  disabled?: boolean;
  /** Hide the per-row delete button (renderRow calls api.remove itself). */
  hideDelete?: boolean;
  className?: string;
  'aria-label'?: string;
}

const isPlainObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

export function RepeatableList<T>({
  items,
  onChange,
  getKey,
  renderRow,
  renderSummary,
  itemLabel,
  newItem,
  onAdd,
  addLabel = 'Adaugă',
  emptyLabel,
  reorder = false,
  expandable = false,
  defaultExpanded,
  confirmDelete = false,
  maxItems,
  disabled = false,
  hideDelete = false,
  className,
  'aria-label': ariaLabel,
}: RepeatableListProps<T>) {
  React.useInsertionEffect(() => ensureAdminUi(), []);
  const [open, setOpen] = React.useState<Set<string | number>>(() => new Set(defaultExpanded ?? []));
  const [asking, setAsking] = React.useState<number | null>(null);
  const itemsRef = React.useRef(items);
  itemsRef.current = items;

  const labelOf = (item: T, i: number) => itemLabel?.(item, i) ?? `elementul ${i + 1}`;

  const drag = useDragReorder({
    count: items.length,
    disabled: disabled || !reorder,
    onMove: (from, to) => onChange(moveItem(itemsRef.current, from, to)),
  });

  const removeAt = (i: number) => {
    const cur = itemsRef.current;
    const key = getKey(cur[i], i);
    setOpen((s) => {
      if (!s.has(key)) return s;
      const n = new Set(s);
      n.delete(key);
      return n;
    });
    onChange(cur.filter((_, j) => j !== i));
  };

  const askRemove = (i: number) => {
    if (disabled) return;
    if (confirmDelete) setAsking(i);
    else removeAt(i);
  };

  const full = maxItems !== undefined && items.length >= maxItems;
  const canAdd = !disabled && !full && Boolean(onAdd || newItem);

  const add = () => {
    if (!canAdd) return;
    if (onAdd) {
      onAdd();
      return;
    }
    if (!newItem) return;
    const it = newItem();
    const next = [...itemsRef.current, it];
    if (expandable) {
      const key = getKey(it, next.length - 1);
      setOpen((s) => new Set(s).add(key));
    }
    onChange(next);
  };

  const confirmCopy = (() => {
    if (asking === null || !items[asking]) return null;
    const name = labelOf(items[asking], asking);
    if (isPlainObject(confirmDelete)) return { title: confirmDelete.title ?? `Ștergi ${name}?`, message: confirmDelete.message, detail: confirmDelete.detail };
    if (typeof confirmDelete === 'string') return { title: `Ștergi ${name}?`, message: confirmDelete, detail: undefined };
    return { title: `Ștergi ${name}?`, message: 'Elementul dispare din listă după ce salvezi pagina.', detail: undefined };
  })();

  return (
    <div className={cx('adm-root', 'adm-rl', className)}>
      {items.length === 0 ? (
        emptyLabel !== undefined && <div className="adm-rl-empty">{emptyLabel}</div>
      ) : (
        <ul className="adm-rl-items" aria-label={ariaLabel}>
          {items.map((item, i) => {
            const key = getKey(item, i);
            const expanded = expandable ? open.has(key) : true;
            const name = labelOf(item, i);
            const api: RepeatableRowApi<T> = {
              index: i,
              expanded,
              update: (patch) => {
                const cur = itemsRef.current;
                const prev = cur[i];
                const nextItem =
                  typeof patch === 'function'
                    ? (patch as (c: T) => T)(prev)
                    : isPlainObject(prev) && isPlainObject(patch)
                      ? ({ ...prev, ...patch } as T)
                      : (patch as T);
                onChange(cur.map((x, j) => (j === i ? nextItem : x)));
              },
              remove: () => askRemove(i),
              toggle: () =>
                setOpen((s) => {
                  const n = new Set(s);
                  if (n.has(key)) n.delete(key);
                  else n.add(key);
                  return n;
                }),
              moveUp: () => drag.move(i, i - 1),
              moveDown: () => drag.move(i, i + 1),
            };

            const lead = reorder ? (
              <>
                <button
                  type="button"
                  className="adm-iconbtn adm-grip"
                  aria-label={`Mută ${name}`}
                  disabled={disabled}
                  {...drag.handleProps(i)}
                >
                  <IconGrip />
                </button>
                <span className="adm-row-move">
                  <button type="button" className="adm-iconbtn" aria-label={`Mută ${name} mai sus`} disabled={disabled || i === 0} onClick={api.moveUp}>
                    <IconChevronUp />
                  </button>
                  <button
                    type="button"
                    className="adm-iconbtn"
                    aria-label={`Mută ${name} mai jos`}
                    disabled={disabled || i === items.length - 1}
                    onClick={api.moveDown}
                  >
                    <IconChevronDown />
                  </button>
                </span>
              </>
            ) : null;

            const del = hideDelete ? null : (
              <button type="button" className="adm-iconbtn adm-iconbtn--danger" aria-label={`Șterge ${name}`} title="Șterge" disabled={disabled} onClick={api.remove}>
                <IconTrash />
              </button>
            );

            const rowProps = reorder ? drag.itemProps(i) : undefined;

            if (expandable) {
              return (
                <ExpandableRow
                  key={key}
                  as="li"
                  rowProps={rowProps}
                  expanded={expanded}
                  onToggle={api.toggle}
                  lead={lead}
                  actions={del}
                  summary={renderSummary ? renderSummary(item, i) : `Element ${i + 1}`}
                >
                  {renderRow(item, i, api)}
                </ExpandableRow>
              );
            }
            return (
              <li key={key} {...rowProps} className="adm-row adm-row--flat">
                {lead && <div className="adm-row-lead">{lead}</div>}
                <div className="adm-row-main">{renderRow(item, i, api)}</div>
                {del && <div className="adm-row-actions">{del}</div>}
              </li>
            );
          })}
        </ul>
      )}
      {(onAdd || newItem) && (
        <>
          <AddButton label={addLabel} onClick={add} disabled={!canAdd} />
          {full && <div className="adm-hint">Ai atins numărul maxim de elemente ({maxItems}).</div>}
        </>
      )}
      {reorder && drag.live}
      {confirmDelete && (
        <ConfirmDialog
          open={confirmCopy !== null}
          title={confirmCopy?.title ?? ''}
          message={confirmCopy?.message ?? ''}
          detail={confirmCopy?.detail}
          confirmLabel="Șterge"
          onCancel={() => setAsking(null)}
          onConfirm={() => {
            if (asking !== null) removeAt(asking);
            setAsking(null);
          }}
        />
      )}
    </div>
  );
}

export default RepeatableList;
