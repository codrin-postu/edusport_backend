import * as React from 'react';
import { cx } from './cx';
import { useFieldControl, type FieldAria } from './Field';
import { Popover } from './Popover';
import { Spinner } from './Spinner';
import { IconChevronDown, IconClose, IconPlus } from './icons';

export interface ComboOption {
  value: string;
  label: string;
  /** Second, muted line (club, year, email). */
  hint?: string;
  disabled?: boolean;
}

export interface SearchableSelectProps {
  value: string | null;
  onChange: (value: string | null, option: ComboOption | null) => void;
  /** Static options, filtered locally. */
  options?: ComboOption[];
  /** Async options for the typed text (debounced 250ms, stale answers dropped). Used instead of `options`. */
  loadOptions?: (query: string) => Promise<ComboOption[]>;
  /** Label of the current value when it is not in the loaded options (async mode). */
  valueLabel?: string;
  placeholder?: string;
  /** Offer "Adaugă „text”" when nothing matches exactly. */
  creatable?: boolean;
  /** Called for the create row; return the new option (or a promise of it) to select it. Default: the text itself. */
  onCreate?: (text: string) => ComboOption | Promise<ComboOption | null> | null | void;
  /** Show the x button while a value is set. Default true. */
  clearable?: boolean;
  disabled?: boolean;
  emptyLabel?: string;
  id?: string;
  'aria-label'?: string;
  'aria-describedby'?: string;
  className?: string;
}

const norm = (s: string) =>
  s
    .toLocaleLowerCase('ro')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

/**
 * Combobox on tokens (not Strapi DS, so it follows the admin light / dark
 * theme). Type to filter, ArrowUp / ArrowDown move, Enter picks, Escape
 * closes the list and drops the typed text, Tab leaves. Diacritics are
 * ignored when matching ("stefan" finds "Ștefan").
 */
export function SearchableSelect({
  value,
  onChange,
  options,
  loadOptions,
  valueLabel,
  placeholder = 'Caută...',
  creatable = false,
  onCreate,
  clearable = true,
  disabled = false,
  emptyLabel = 'Niciun rezultat',
  className,
  ...aria
}: SearchableSelectProps) {
  const p = useFieldControl<FieldAria>({ id: aria.id, 'aria-describedby': aria['aria-describedby'] });
  const [open, setOpen] = React.useState(false);
  const [text, setText] = React.useState<string | null>(null);
  const [active, setActive] = React.useState(0);
  const [loaded, setLoaded] = React.useState<ComboOption[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [failed, setFailed] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  const [picked, setPicked] = React.useState<ComboOption | null>(null);
  const wrapRef = React.useRef<HTMLDivElement | null>(null);
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const listId = React.useId().replace(/:/g, '');
  const reqId = React.useRef(0);

  const query = text ?? '';
  const pool = loadOptions ? loaded : (options ?? []);
  const shown = loadOptions ? pool : pool.filter((o) => !query.trim() || norm(o.label).includes(norm(query.trim())) || norm(o.hint ?? '').includes(norm(query.trim())));
  const current = pool.find((o) => o.value === value) ?? (picked && picked.value === value ? picked : null) ?? (options ?? []).find((o) => o.value === value) ?? null;
  const currentLabel = current?.label ?? (value !== null ? (valueLabel ?? value) : '');
  const exact = shown.some((o) => norm(o.label) === norm(query.trim()));
  const canCreate = creatable && query.trim() !== '' && !exact;
  const rows = shown.length + (canCreate ? 1 : 0);

  React.useEffect(() => {
    if (!loadOptions || !open) return undefined;
    const id = ++reqId.current;
    setLoading(true);
    setFailed(false);
    const t = window.setTimeout(() => {
      loadOptions(query.trim())
        .then((list) => {
          if (id === reqId.current) setLoaded(list);
        })
        .catch(() => {
          if (id === reqId.current) setFailed(true);
        })
        .finally(() => {
          if (id === reqId.current) setLoading(false);
        });
    }, 250);
    return () => window.clearTimeout(t);
  }, [loadOptions, open, query]);

  React.useEffect(() => {
    if (active >= rows) setActive(Math.max(0, rows - 1));
  }, [rows, active]);

  const close = () => {
    setOpen(false);
    setText(null);
  };

  const choose = (o: ComboOption) => {
    if (o.disabled) return;
    setPicked(o);
    onChange(o.value, o);
    close();
  };

  const create = async () => {
    const t = query.trim();
    if (!t) return;
    if (!onCreate) {
      choose({ value: t, label: t });
      return;
    }
    setCreating(true);
    try {
      const made = await onCreate(t);
      if (made) choose(made);
      else close();
    } finally {
      setCreating(false);
    }
  };

  const pickActive = () => {
    if (active < shown.length) {
      const o = shown[active];
      if (o) choose(o);
    } else if (canCreate) void create();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) setOpen(true);
      else setActive((a) => Math.min(a + 1, rows - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === 'Home' && open) {
      setActive(0);
    } else if (e.key === 'End' && open) {
      setActive(Math.max(0, rows - 1));
    } else if (e.key === 'Enter') {
      if (open && rows > 0) {
        e.preventDefault();
        pickActive();
      }
    } else if (e.key === 'Escape') {
      if (text !== null) {
        e.preventDefault();
        setText(null);
      }
    } else if (e.key === 'Tab') {
      close();
    }
  };

  const activeId = open && rows > 0 ? `${listId}-${active}` : undefined;

  return (
    <div ref={wrapRef} className={cx('ui-root', 'ui-cbx', disabled && 'ui-cbx--disabled', className)}>
      <input
        ref={inputRef}
        className="ui-input"
        id={p.id}
        role="combobox"
        aria-label={aria['aria-label']}
        aria-describedby={p['aria-describedby']}
        aria-invalid={p['aria-invalid']}
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-autocomplete="list"
        aria-activedescendant={activeId}
        autoComplete="off"
        disabled={disabled}
        placeholder={currentLabel || placeholder}
        value={text ?? currentLabel}
        onChange={(e) => {
          setText(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={(e) => e.target.select()}
        onClick={() => setOpen(true)}
        onBlur={() => {
          // A click on an option keeps focus (mousedown is prevented), so a
          // real blur means the user left the field.
          close();
        }}
        onKeyDown={onKeyDown}
      />
      <span className="ui-cbx-actions">
        {loading && open && <Spinner size={12} />}
        {clearable && value !== null && !disabled && (
          <button
            type="button"
            className="ui-iconbtn ui-iconbtn--sm"
            aria-label="Golește selecția"
            onClick={() => {
              setPicked(null);
              onChange(null, null);
              setText(null);
              inputRef.current?.focus();
            }}
          >
            <IconClose size={12} />
          </button>
        )}
        <button
          type="button"
          className="ui-iconbtn ui-iconbtn--sm"
          tabIndex={-1}
          aria-label={open ? 'Închide lista' : 'Deschide lista'}
          disabled={disabled}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            if (open) close();
            else {
              setOpen(true);
              inputRef.current?.focus();
            }
          }}
        >
          <IconChevronDown size={12} />
        </button>
      </span>
      <Popover open={open && !disabled} anchorRef={wrapRef} onClose={close} matchWidth className="ui-list" id={listId} role="listbox" popoverProps={{ onMouseDown: (e) => e.preventDefault() }}>
        {shown.map((o, i) => (
          <div
            key={o.value}
            id={`${listId}-${i}`}
            role="option"
            aria-selected={o.value === value}
            aria-disabled={o.disabled || undefined}
            className="ui-opt"
            data-active={i === active || undefined}
            onMouseEnter={() => setActive(i)}
            onClick={() => choose(o)}
          >
            <span>{o.label}</span>
            {o.hint && <span className="ui-opt-hint">{o.hint}</span>}
          </div>
        ))}
        {canCreate && (
          <div
            id={`${listId}-${shown.length}`}
            role="option"
            aria-selected={false}
            className="ui-opt ui-opt--create"
            data-active={active === shown.length || undefined}
            onMouseEnter={() => setActive(shown.length)}
            onClick={() => void create()}
          >
            {creating ? <Spinner size={12} /> : <IconPlus size={12} />}
            <span>Adaugă „{query.trim()}”</span>
          </div>
        )}
        {rows === 0 && (
          <div className="ui-list-note" role="presentation">
            {loading ? 'Se caută...' : failed ? 'Nu am putut încărca opțiunile.' : emptyLabel}
          </div>
        )}
      </Popover>
    </div>
  );
}

export default SearchableSelect;
