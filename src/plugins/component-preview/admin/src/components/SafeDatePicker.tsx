import * as React from 'react';
import { DatePicker as StrapiDatePicker } from '@strapi/design-system';

type StrapiDatePickerProps = React.ComponentProps<typeof StrapiDatePicker>;

// Strapi's DatePicker has been observed reinterpreting Dates as UTC internally,
// which makes a Date constructed at local midnight render as the previous day
// in negative-offset zones. Anchoring at local 12:00 keeps the calendar day
// stable regardless of how the underlying picker re-serializes the value.
function anchorAtLocalNoon(d: Date | null | undefined): Date | undefined {
  if (!d) return undefined;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0, 0);
}

/**
 * Drop-in replacement for `@strapi/design-system`'s `DatePicker` that
 * neutralizes the timezone-shift bug. Both the value passed in and the value
 * passed out via `onChange` are normalized to local noon, so consumers can
 * read `getFullYear()/getMonth()/getDate()` without worrying about UTC drift.
 *
 * Use this everywhere a date-only field is needed - the centralized fix means
 * each callsite no longer has to remember its own noon-anchoring helper.
 */
export const SafeDatePicker = React.forwardRef<HTMLInputElement, StrapiDatePickerProps>(
  function SafeDatePicker({ value, onChange, minDate, maxDate, locale, ...rest }, ref) {
    return (
      <StrapiDatePicker
        ref={ref}
        {...rest}
        // Default to Romanian (dd/mm/yyyy) so the displayed format matches the
        // `zz/ll/aaaa` placeholder. Callers can override by passing `locale`.
        locale={locale ?? 'ro-RO'}
        value={anchorAtLocalNoon(value)}
        minDate={anchorAtLocalNoon(minDate)}
        maxDate={anchorAtLocalNoon(maxDate)}
        onChange={(d) => onChange?.(anchorAtLocalNoon(d))}
      />
    );
  },
);
