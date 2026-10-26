import * as React from 'react';
import { cx } from './cx';
import { useFieldControl, type FieldAria } from './Field';
import { Popover } from './Popover';
import { IconCheck, IconChevronDown } from './icons';
import { edgeIndex, scrollTopFor, selectKeyAction, typeaheadIndex } from '../../club/ui-select';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends FieldAria {
  value: string;
  onChange?: (value: string) => void;
  options?: SelectOption[];
  /** Adds a first option with this text and the value '' (picking it clears the choice). */
  placeholder?: string;
  disabled?: boolean;
  /** On the button (it also carries `ui-input`). */
  className?: string;
  /** On the button, e.g. the status colours of the Înscrieri status select. */
  style?: React.CSSProperties;
  'aria-label'?: string;
}

/** Pause after which typed letters start a new search (ms). */
const TYPEAHEAD_MS = 500;

const rowsOf = (options: SelectOption[] | undefined, placeholder: string | undefined): SelectOption[] =>
  placeholder === undefined ? (options ?? []) : [{ value: '', label: placeholder }, ...(options ?? [])];

function assignRef<T>(ref: React.ForwardedRef<T>, value: T | null): void {
  if (typeof ref === 'function') ref(value);
  else if (ref) ref.current = value;
}

interface ListState {
  open: boolean;
  active: number;
  selected: number;
  setActive: (i: number) => void;
  show: (i: number) => void;
  close: () => void;
  choose: (i: number) => void;
  typeahead: (ch: string) => void;
}

/** Letters typed within TYPEAHEAD_MS of each other search together. */
function useTypeahead(rows: SelectOption[], from: number, onMatch: (i: number) => void): (ch: string) => void {
  const typed = React.useRef({ text: '', at: 0 });
  return (ch: string) => {
    const now = Date.now();
    const text = (now - typed.current.at < TYPEAHEAD_MS ? typed.current.text : '') + ch;
    typed.current = { text, at: now };
    const i = typeaheadIndex(rows, from, text);
    if (i >= 0) onMatch(i);
  };
}

/** Open state, highlighted row and type-ahead of one Select. */
function useListState(rows: SelectOption[], value: string, pick: (v: string) => void): ListState {
  const [open, setOpen] = React.useState(false);
  const [active, setActive] = React.useState(-1);
  const selected = rows.findIndex((r) => r.value === value);
  const close = () => setOpen(false);
  const show = (i: number) => {
    setActive(i);
    setOpen(true);
  };
  const choose = (i: number) => {
    const row = rows[i];
    if (!row || row.disabled) return;
    pick(row.value);
    close();
  };
  const typeahead = useTypeahead(rows, open ? active : selected, (i) => (open ? setActive(i) : pick(rows[i].value)));
  return { open, active, selected, setActive, show, close, choose, typeahead };
}

/** Keys on the button: open, move, pick, close; other printable keys search. */
function keyHandler(list: ListState, rows: SelectOption[]) {
  return (e: React.KeyboardEvent<HTMLButtonElement>) => {
    const act = selectKeyAction(e.key, list.open, rows, list.open ? list.active : list.selected);
    if (act.type === 'none') {
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) list.typeahead(e.key);
      return;
    }
    if (e.key !== 'Tab') e.preventDefault();
    if (act.type === 'open') list.show(act.index);
    else if (act.type === 'move') list.setActive(act.index);
    else if (act.type === 'pick') list.choose(act.index);
    else list.close();
  };
}

interface TriggerProps extends FieldAria {
  rows: SelectOption[];
  selected: number;
  open: boolean;
  active: number;
  listId: string;
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
  'aria-label'?: string;
  onToggle: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLButtonElement>) => void;
}

/** The button: every label stacked in one grid cell, so it is as wide as the longest one (like a native select). */
const SelectTrigger = React.forwardRef<HTMLButtonElement, TriggerProps>(function SelectTrigger(
  { rows, selected, open, active, listId, disabled, className, style, required, onToggle, onKeyDown, ...aria },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      role="combobox"
      aria-haspopup="listbox"
      aria-expanded={open}
      aria-controls={open ? listId : undefined}
      aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
      aria-required={required || undefined}
      {...aria}
      disabled={disabled}
      className={cx('ui-input', 'ui-sel', className)}
      style={style}
      onClick={onToggle}
      onKeyDown={onKeyDown}
    >
      <span className="ui-sel-val">
        {rows.map((r, i) => (
          <span key={`${i}-${r.value}`} data-on={i === selected || undefined}>
            {r.label}
          </span>
        ))}
        {selected < 0 && <span data-on>{' '}</span>}
      </span>
      <span className="ui-sel-chev" aria-hidden="true">
        <IconChevronDown size={12} />
      </span>
    </button>
  );
});

interface ListProps {
  rows: SelectOption[];
  value: string;
  list: ListState;
  listId: string;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
  disabled?: boolean;
}

/** The open list: the shared Popover + ui-opt rows, the selected option ticked. */
function SelectList({ rows, value, list, listId, anchorRef, disabled }: ListProps) {
  const boxRef = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    const box = boxRef.current;
    const el = list.open && list.active >= 0 ? document.getElementById(`${listId}-${list.active}`) : null;
    if (box && el) box.scrollTop = scrollTopFor(el.offsetTop, el.offsetHeight, box.scrollTop, box.clientHeight);
  }, [list.open, list.active, listId]);
  return (
    <Popover
      open={list.open && !disabled}
      anchorRef={anchorRef}
      onClose={list.close}
      matchWidth
      className="ui-list ui-sel-list"
      id={listId}
      role="listbox"
      popoverRef={boxRef}
      popoverProps={{ onMouseDown: (e) => e.preventDefault() }}
    >
      {rows.map((r, i) => (
        <div
          key={`${i}-${r.value}`}
          id={`${listId}-${i}`}
          role="option"
          aria-selected={r.value === value}
          aria-disabled={r.disabled || undefined}
          className="ui-opt ui-sel-opt"
          data-active={i === list.active || undefined}
          onMouseEnter={() => list.setActive(i)}
          onClick={() => list.choose(i)}
        >
          <span className="ui-sel-tick" aria-hidden="true">
            {r.value === value && <IconCheck size={12} />}
          </span>
          <span>{r.label}</span>
        </div>
      ))}
    </Popover>
  );
}

/**
 * Admin-wide select (DECISIONS 2026-10-06 open-questions-v2 Q8): a button with
 * a chevron that opens the shared list, the selected option ticked. Keyboard
 * as a select-only combobox: ArrowDown / ArrowUp / Enter / Space open, then
 * move and pick; Home / End; Escape and Tab close; typed letters jump to an
 * option (diacritics ignored), also while closed. Focus stays on the button,
 * so Modal / Drawer / BottomSheet focus traps keep working. Inside a Field it
 * picks up id, aria and required. onChange fires only for a different value.
 */
export const Select = React.forwardRef<HTMLButtonElement, SelectProps>(function Select(
  { value, onChange, options, placeholder, disabled, className, style, ...rest },
  ref,
) {
  const field = useFieldControl(rest);
  const rows = rowsOf(options, placeholder);
  const list = useListState(rows, value, (v) => v !== value && onChange?.(v));
  const anchorRef = React.useRef<HTMLButtonElement | null>(null);
  const listId = React.useId().replace(/:/g, '');
  const toggle = () => (list.open ? list.close() : list.show(list.selected >= 0 ? list.selected : edgeIndex(rows, 'first')));
  const setRefs = (el: HTMLButtonElement | null) => {
    anchorRef.current = el;
    assignRef(ref, el);
  };
  return (
    <>
      <SelectTrigger
        {...field}
        ref={setRefs}
        rows={rows}
        selected={list.selected}
        open={list.open}
        active={list.active}
        listId={listId}
        disabled={disabled}
        className={className}
        style={style}
        onToggle={toggle}
        onKeyDown={keyHandler(list, rows)}
      />
      <SelectList rows={rows} value={value} list={list} listId={listId} anchorRef={anchorRef} disabled={disabled} />
    </>
  );
});

export default Select;
