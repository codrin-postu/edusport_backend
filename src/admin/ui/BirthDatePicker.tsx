import * as React from 'react';
import { DateInput } from './DateInput';
import type { FieldAria } from './Field';
import { EMPTY_DATE, birthDateRange, partsFromIso, partsToIso, type DateParts } from '../../club/ui-birth-date';

export interface BirthDatePickerProps extends FieldAria {
  /** The date as parts; EMPTY_DATE for none. Convert with partsFromDisplay / partsFromIso. */
  value: DateParts;
  /** New parts after the pick; EMPTY_DATE when the date is cleared or incomplete. Check with partsToDisplay / partsToIso / isFullDate. */
  onChange: (next: DateParts) => void;
  /** Anchor of the year range (25 to 2 years ago). Default: today. */
  today?: Date;
  disabled?: boolean;
  /** Optional dates (Activ din). The native input can always be emptied; kept so callers state intent. Default false. */
  clearable?: boolean;
  className?: string;
}

/**
 * Birth date as one native date picker (spec 3.4, 6.2, 8): the Înscrieri
 * Editează form, the athlete record Date tab, Adaugă sportiv and Activ din.
 * It takes the enclosing Field's id, label, hint and error like any control.
 * The range is the website's (25 to 2 years ago), widened to keep a stored
 * date outside it selectable.
 */
export function BirthDatePicker({ value, onChange, today, disabled, clearable: _clearable, className, ...rest }: BirthDatePickerProps) {
  const { min, max } = birthDateRange((today ?? new Date()).getFullYear(), value);
  return (
    <DateInput
      {...rest}
      className={className}
      disabled={disabled}
      min={min}
      max={max}
      value={partsToIso(value)}
      onChange={(iso) => onChange(partsFromIso(iso) ?? EMPTY_DATE)}
    />
  );
}

export default BirthDatePicker;
