import * as React from 'react';
import { DateInput } from './DateInput';
import type { FieldAria } from './Field';
import { birthDateRange, partsToIso, pickedDate, type DateParts } from '../../club/ui-birth-date';

export interface BirthDatePickerProps extends FieldAria {
  /** The date as parts; EMPTY_DATE for none. Convert with partsFromDisplay / partsFromIso. */
  value: DateParts;
  /** New parts after the pick. Not called while the input holds a half-typed date. A date outside the range arrives as a non-full, non-blank date. Check with partsToDisplay / partsToIso / isFullDate. */
  onChange: (next: DateParts) => void;
  /** Anchor of the year range (25 to 2 years ago). Default: today. */
  today?: Date;
  disabled?: boolean;
  className?: string;
}

/**
 * Birth date as one native date picker (spec 3.4, 6.2, 8): the Înscrieri
 * Editează form, the athlete record Date tab, Adaugă sportiv and Activ din.
 * It takes the enclosing Field's id, label, hint and error like any control.
 * The range is the website's (25 to 2 years ago), widened to keep a stored
 * date outside it selectable; a typed date outside it counts as not chosen.
 * The shown text is kept here, so a typed year (0002, 0020, ...) is not
 * overwritten while the user types; it follows `value` when the parent
 * replaces it.
 */
export function BirthDatePicker({ value, onChange, today, disabled, className, ...rest }: BirthDatePickerProps) {
  const range = birthDateRange((today ?? new Date()).getFullYear(), value);
  const input = React.useRef<HTMLInputElement>(null);
  const sent = React.useRef(value);
  const [text, setText] = React.useState(() => partsToIso(value) ?? '');
  React.useEffect(() => {
    if (value === sent.current) return;
    sent.current = value;
    setText(partsToIso(value) ?? '');
  }, [value]);
  const change = (iso: string | null) => {
    setText(iso ?? '');
    // An empty value with badInput is a half-typed date, not a clear: tell nobody yet.
    if (iso === null && input.current?.validity.badInput) return;
    const next = pickedDate(iso, range);
    sent.current = next;
    onChange(next);
  };
  return <DateInput {...rest} ref={input} className={className} disabled={disabled} min={range.min} max={range.max} value={text || null} onChange={change} />;
}

export default BirthDatePicker;
