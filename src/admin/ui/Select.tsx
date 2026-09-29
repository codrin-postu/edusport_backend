import * as React from 'react';
import { cx } from './cx';
import { useFieldControl } from './Field';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> {
  /** Shorthand for simple lists; children <option>s work too. */
  options?: SelectOption[];
  /** Adds a first empty option with this text. */
  placeholder?: string;
  onChange?: (value: string, e: React.ChangeEvent<HTMLSelectElement>) => void;
}

/** Native select. Inside a Field it picks up id, aria and required automatically. */
export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, options, placeholder, onChange, children, ...props },
  ref,
) {
  const p = useFieldControl(props);
  return (
    <select ref={ref} className={cx('adm-input', className)} onChange={(e) => onChange?.(e.target.value, e)} {...p}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options?.map((o) => (
        <option key={o.value} value={o.value} disabled={o.disabled}>
          {o.label}
        </option>
      ))}
      {children}
    </select>
  );
});

export default Select;
