import * as React from 'react';
import { cx } from './cx';
import { useFieldControl } from './Field';
import { IconCalendar } from './icons';
import { TimeInput } from './TimeInput';
import { useDateInput } from './useDateInput';
import { DATE_PLACEHOLDER, isoToSlash } from '../../club/date-format';

export interface DateInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange'> {
  /** ISO date "YYYY-MM-DD" (or datetime "YYYY-MM-DDTHH:mm" with withTime), null for empty. */
  value: string | null;
  onChange: (value: string | null) => void;
  withTime?: boolean;
}

/**
 * Date field typed as dd/mm/yyyy (placeholder "zz / ll / aaaa") with a calendar
 * button that opens the browser's picker. The contract stays a null-for-empty
 * ISO value, so pages send it straight to Strapi: "YYYY-MM-DD", or
 * "YYYY-MM-DDTHH:mm" with withTime (a TimeInput sits next to the date).
 * min / max bound the picker and the typed date; a typed date that is impossible or outside them is marked invalid and not emitted.
 */
export const DateInput = React.forwardRef<HTMLInputElement, DateInputProps>(function DateInput(
  { className, value, onChange, withTime = false, min, max, disabled, onBlur, onFocus, placeholder = DATE_PLACEHOLDER, ...props },
  ref,
) {
  const p = useFieldControl(props);
  const day = value ? String(value).slice(0, 10) : '';
  const time = withTime && value && String(value).length >= 16 ? String(value).slice(11, 16) : '';
  const emitDay = (iso: string | null) => onChange(iso === null ? null : withTime ? `${iso}T${time || '00:00'}` : iso);
  const { native, draft, invalid, type, settle, openPicker } = useDateInput({
    min: typeof min === 'string' ? min : undefined, max: typeof max === 'string' ? max : undefined, emitDay, value,
  });

  return (
    <span className={cx('ui-root', 'ui-date', withTime && 'ui-date--time', disabled && 'ui-date--disabled', className)}>
      <span className="ui-date-field">
        <input
          ref={ref}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          maxLength={10}
          placeholder={placeholder}
          className="ui-input"
          disabled={disabled}
          {...p}
          aria-invalid={invalid || p['aria-invalid']}
          value={draft ?? (isoToSlash(day) ?? '')}
          onChange={(e) => type(e.target.value)}
          onFocus={(e) => {
            e.target.select();
            onFocus?.(e);
          }}
          onBlur={(e) => {
            settle();
            onBlur?.(e);
          }}
        />
        <button type="button" className="ui-date-btn" aria-label="Alege data" title="Alege data" disabled={disabled} onClick={openPicker}>
          <IconCalendar />
        </button>
        <input
          ref={native}
          type="date"
          className="ui-date-native"
          tabIndex={-1}
          aria-hidden="true"
          lang="ro"
          disabled={disabled}
          min={typeof min === 'string' ? min.slice(0, 10) : undefined}
          max={typeof max === 'string' ? max.slice(0, 10) : undefined}
          value={day}
          onChange={(e) => emitDay(e.target.value === '' ? null : e.target.value)}
        />
      </span>
      {withTime && (
        <span className="ui-date-time">
          <TimeInput
            value={time || null}
            disabled={disabled || !day}
            onChange={(t) => {
              if (day) onChange(`${day}T${t ?? '00:00'}`);
            }}
          />
        </span>
      )}
    </span>
  );
});

export default DateInput;
