import * as React from 'react';
import { cx } from './cx';
import { NoFieldContext, useFieldControl, useFieldLabelId, type FieldAria } from './Field';
import { Select, type SelectOption } from './Select';
import {
  PART_LABELS,
  PART_PLACEHOLDERS,
  dayChoices,
  monthChoices,
  pickPart,
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
  /** Optional dates (Activ din): the empty first row "Zi" / "Lună" / "An" of any select clears the whole date. Default false. */
  clearable?: boolean;
  className?: string;
}

const asText = (n: number | null): string => (n === null ? '' : String(n));
const asNumber = (v: string): number | null => (v === '' ? null : Number(v));
const asOptions = (list: PartChoice[]): SelectOption[] => list.map((c) => ({ value: String(c.value), label: c.label }));

/**
 * Birth date as three admin Selects zi / lună / an (spec 3.4, 6.2, 8): the
 * Înscrieri Editează form and the athlete record Date tab. Inside a Field the
 * wrapping group (not any one select) carries the Field's own label via
 * aria-labelledby, so a screen reader announces it once on entering the
 * group; each select additionally references that same label plus its own
 * part name ("Zi" / "Lună" / "An", kept as the visible placeholder), so every
 * select reads e.g. "Data nașterii Zi" instead of a bare, contextless part
 * name. Outside a Field (no enclosing label to reference) each select falls
 * back to its bare part name. Hint and error (from the Field) go to all three.
 */
export function BirthDatePicker({ value, onChange, today, disabled, clearable = false, className, ...rest }: BirthDatePickerProps) {
  const field = useFieldControl<FieldAria>(rest);
  const labelId = useFieldLabelId();
  const auto = React.useId().replace(/:/g, '');
  const baseId = field.id ?? `ui-bdate${auto}`;
  const year = (today ?? new Date()).getFullYear();
  const set = (key: keyof DateParts) => (v: string) => onChange(pickPart(value, key, asNumber(v), clearable));
  const shared = { disabled, 'aria-describedby': field['aria-describedby'], 'aria-invalid': field['aria-invalid'], required: field.required };
  const partAria = (part: 'day' | 'month' | 'year'): { 'aria-labelledby': string } | { 'aria-label': string } =>
    labelId ? { 'aria-labelledby': `${labelId} ${baseId}-${part}-txt` } : { 'aria-label': PART_LABELS[part] };
  return (
    <div role="group" className={cx('ui-bdate', className)} {...(labelId ? { 'aria-labelledby': labelId } : {})}>
      <NoFieldContext>
        {labelId && (
          <span id={`${baseId}-day-txt`} className="ui-sr">
            {PART_LABELS.day}
          </span>
        )}
        <Select
          {...shared}
          {...partAria('day')}
          id={field.id}
          placeholder={PART_PLACEHOLDERS.day}
          value={asText(value.day)}
          options={asOptions(dayChoices(value))}
          onChange={set('day')}
        />
        {labelId && (
          <span id={`${baseId}-month-txt`} className="ui-sr">
            {PART_LABELS.month}
          </span>
        )}
        <Select
          {...shared}
          {...partAria('month')}
          placeholder={PART_PLACEHOLDERS.month}
          value={asText(value.month)}
          options={asOptions(monthChoices())}
          onChange={set('month')}
        />
        {labelId && (
          <span id={`${baseId}-year-txt`} className="ui-sr">
            {PART_LABELS.year}
          </span>
        )}
        <Select
          {...shared}
          {...partAria('year')}
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
