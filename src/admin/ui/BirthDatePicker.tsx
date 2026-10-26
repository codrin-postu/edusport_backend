import * as React from 'react';
import { cx } from './cx';
import { NoFieldContext, useFieldControl, type FieldAria } from './Field';
import { Select, type SelectOption } from './Select';
import {
  PART_LABELS,
  PART_PLACEHOLDERS,
  dayChoices,
  monthChoices,
  withPart,
  yearChoices,
  type DateParts,
  type PartChoice,
} from '../../club/ui-birth-date';

export interface BirthDatePickerProps extends FieldAria {
  /** The three parts; EMPTY_DATE for none. Convert with partsFromDisplay / partsFromIso. */
  value: DateParts;
  /** New parts after any select changes; check completeness with partsToDisplay / partsToIso / isFullDate. */
  onChange: (next: DateParts) => void;
  /** Anchor of the year range (25 to 2 years ago). Default: today. */
  today?: Date;
  disabled?: boolean;
  className?: string;
}

const asText = (n: number | null): string => (n === null ? '' : String(n));
const asNumber = (v: string): number | null => (v === '' ? null : Number(v));
const asOptions = (list: PartChoice[]): SelectOption[] => list.map((c) => ({ value: String(c.value), label: c.label }));

/**
 * Birth date as three admin Selects zi / lună / an (spec 3.4, 6.2, 8): the
 * Înscrieri Editează form and the athlete record Date tab. Inside a Field the
 * label points at the day select; hint and error go to all three.
 */
export function BirthDatePicker({ value, onChange, today, disabled, className, ...rest }: BirthDatePickerProps) {
  const field = useFieldControl<FieldAria>(rest);
  const year = (today ?? new Date()).getFullYear();
  const set = (key: keyof DateParts) => (v: string) => onChange(withPart(value, key, asNumber(v)));
  const shared = { disabled, 'aria-describedby': field['aria-describedby'], 'aria-invalid': field['aria-invalid'], required: field.required };
  return (
    <div role="group" className={cx('ui-bdate', className)}>
      <NoFieldContext>
        <Select
          {...shared}
          id={field.id}
          aria-label={PART_LABELS.day}
          placeholder={PART_PLACEHOLDERS.day}
          value={asText(value.day)}
          options={asOptions(dayChoices(value))}
          onChange={set('day')}
        />
        <Select
          {...shared}
          aria-label={PART_LABELS.month}
          placeholder={PART_PLACEHOLDERS.month}
          value={asText(value.month)}
          options={asOptions(monthChoices())}
          onChange={set('month')}
        />
        <Select
          {...shared}
          aria-label={PART_LABELS.year}
          placeholder={PART_PLACEHOLDERS.year}
          value={asText(value.year)}
          options={asOptions(yearChoices(year, value.year))}
          onChange={set('year')}
        />
      </NoFieldContext>
    </div>
  );
}

export default BirthDatePicker;
