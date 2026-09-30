import * as React from 'react';
import { cx } from './cx';
import { useFieldControl } from './Field';

export interface DateInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange'> {
  /** ISO date "YYYY-MM-DD" (or datetime "YYYY-MM-DDTHH:mm" with withTime), null for empty. */
  value: string | null;
  onChange: (value: string | null) => void;
  withTime?: boolean;
}

/**
 * Native date (or datetime-local) input with a null-for-empty contract, so
 * pages can send the value straight to Strapi. Follows the theme through
 * color-scheme on .ui-root.
 */
export const DateInput = React.forwardRef<HTMLInputElement, DateInputProps>(function DateInput(
  { className, value, onChange, withTime = false, ...props },
  ref,
) {
  const p = useFieldControl(props);
  const shown = value ? String(value).slice(0, withTime ? 16 : 10) : '';
  return (
    <input
      ref={ref}
      type={withTime ? 'datetime-local' : 'date'}
      className={cx('ui-input', className)}
      value={shown}
      onChange={(e) => onChange(e.target.value === '' ? null : e.target.value)}
      {...p}
    />
  );
});

export default DateInput;
