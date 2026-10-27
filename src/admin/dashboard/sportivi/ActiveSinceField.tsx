import * as React from 'react';
import { BirthDatePicker, EMPTY_DATE, Field, partsFromIso, partsToIso, type DateParts } from '../../ui';
import { BIRTH_YEARS_AGO } from '../../../club/ui-birth-date';

const LABEL = 'Activ din';
const isEmpty = (p: DateParts): boolean => p.day === null && p.month === null && p.year === null;
/** The picker lists years up to 2 years before its anchor: anchored 2 years ahead, it reaches this year. */
const anchor = (): Date => new Date(new Date().getFullYear() + BIRTH_YEARS_AGO.newest, 0, 1);

/**
 * "Activ din" with the admin date picker (BirthDatePicker). `value` is ISO "YYYY-MM-DD" or '';
 * clearing the picker gives '' (saved as null; polish 9).
 */
export function ActiveSinceField({ value, onChange }: { value: string; onChange: (iso: string) => void }) {
  const [parts, setParts] = React.useState<DateParts>(() => partsFromIso(value) ?? EMPTY_DATE);
  React.useEffect(() => {
    setParts((p) => (partsToIso(p) === (value || null) ? p : (partsFromIso(value) ?? EMPTY_DATE)));
  }, [value]);
  const change = (next: DateParts) => {
    setParts(next);
    const iso = partsToIso(next);
    if (iso !== null || isEmpty(next)) onChange(iso ?? '');
  };
  return (
    <Field label={LABEL}>
      <BirthDatePicker value={parts} onChange={change} today={anchor()} />
    </Field>
  );
}
