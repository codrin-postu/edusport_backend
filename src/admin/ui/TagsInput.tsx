import * as React from 'react';
import { cx } from './cx';
import { useFieldControl, type FieldAria } from './Field';
import { Chip } from './Chip';
import { Popover } from './Popover';

export interface TagsInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  /** Offered while typing (filtered, already chosen ones hidden). */
  suggestions?: string[];
  /** Only suggestions can be added. Default false. */
  suggestionsOnly?: boolean;
  placeholder?: string;
  maxTags?: number;
  disabled?: boolean;
  id?: string;
  'aria-label'?: string;
  'aria-describedby'?: string;
  className?: string;
}

const norm = (s: string) => s.trim().toLocaleLowerCase('ro');

/**
 * Chips + free text. Enter or comma adds the typed text (pasted
 * "a, b, c" adds three), Backspace in the empty input removes the last chip,
 * duplicates are ignored (case-insensitive). With `suggestions`, a list opens
 * under the field: ArrowUp / ArrowDown pick, Enter adds, Escape closes.
 */
export function TagsInput({
  value,
  onChange,
  suggestions,
  suggestionsOnly = false,
  placeholder = 'Scrie și apasă Enter',
  maxTags,
  disabled = false,
  className,
  ...aria
}: TagsInputProps) {
  const p = useFieldControl<FieldAria>({ id: aria.id, 'aria-describedby': aria['aria-describedby'] });
  const [text, setText] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const [active, setActive] = React.useState(0);
  const boxRef = React.useRef<HTMLDivElement | null>(null);
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const listId = React.useId().replace(/:/g, '');

  const full = maxTags !== undefined && value.length >= maxTags;
  const taken = new Set(value.map(norm));
  const matches = (suggestions ?? []).filter((s) => !taken.has(norm(s)) && (!text.trim() || norm(s).includes(norm(text)))).slice(0, 50);
  const showList = open && !disabled && !full && matches.length > 0;

  const addMany = (raw: string[]) => {
    const next = value.slice();
    const seen = new Set(next.map(norm));
    for (const r of raw) {
      const t = r.trim();
      if (!t || seen.has(norm(t))) continue;
      if (suggestionsOnly && !(suggestions ?? []).some((s) => norm(s) === norm(t))) continue;
      if (maxTags !== undefined && next.length >= maxTags) break;
      seen.add(norm(t));
      next.push(t);
    }
    if (next.length !== value.length) onChange(next);
  };

  const commitText = () => {
    if (!text.trim()) return;
    addMany(text.split(','));
    setText('');
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      if (e.key === 'Enter' && showList && matches[active]) {
        e.preventDefault();
        addMany([matches[active]]);
        setText('');
        setActive(0);
        return;
      }
      if (text.trim() || e.key === 'Enter') e.preventDefault();
      commitText();
    } else if (e.key === 'Backspace' && text === '' && value.length > 0) {
      e.preventDefault();
      onChange(value.slice(0, -1));
    } else if (e.key === 'ArrowDown' && suggestions?.length) {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(a + 1, Math.max(0, matches.length - 1)));
    } else if (e.key === 'ArrowUp' && showList) {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    }
  };

  return (
    <div
      ref={boxRef}
      className={cx('ui-root', 'ui-tags', disabled && 'ui-tags--disabled', className)}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) {
          e.preventDefault();
          inputRef.current?.focus();
        }
      }}
    >
      {value.map((t, i) => (
        <Chip key={`${t}-${i}`} onRemove={disabled ? undefined : () => onChange(value.filter((_, j) => j !== i))}>
          {t}
        </Chip>
      ))}
      <input
        ref={inputRef}
        className="ui-tags-in"
        id={p.id}
        aria-label={aria['aria-label']}
        aria-describedby={p['aria-describedby']}
        aria-invalid={p['aria-invalid']}
        role={suggestions ? 'combobox' : undefined}
        aria-expanded={suggestions ? showList : undefined}
        aria-controls={showList ? listId : undefined}
        aria-autocomplete={suggestions ? 'list' : undefined}
        aria-activedescendant={showList && matches[active] ? `${listId}-${active}` : undefined}
        value={text}
        disabled={disabled || full}
        placeholder={full ? `Maxim ${maxTags}` : value.length ? '' : placeholder}
        autoComplete="off"
        onChange={(e) => {
          const v = e.target.value;
          if (v.includes(',')) {
            const parts = v.split(',');
            addMany(parts.slice(0, -1));
            setText(parts[parts.length - 1]);
          } else setText(v);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          commitText();
          setOpen(false);
        }}
        onKeyDown={onKeyDown}
      />
      <Popover open={showList} anchorRef={boxRef} onClose={() => setOpen(false)} matchWidth className="ui-list" id={listId} role="listbox">
        {matches.map((m, i) => (
          <div
            key={m}
            id={`${listId}-${i}`}
            role="option"
            aria-selected={i === active}
            className="ui-opt"
            data-active={i === active || undefined}
            onMouseDown={(e) => {
              e.preventDefault();
              addMany([m]);
              setText('');
            }}
            onMouseEnter={() => setActive(i)}
          >
            {m}
          </div>
        ))}
      </Popover>
    </div>
  );
}

export default TagsInput;
