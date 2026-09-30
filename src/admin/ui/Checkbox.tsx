import * as React from 'react';
import { cx } from './cx';

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange' | 'checked'> {
  checked: boolean;
  onChange: (next: boolean) => void;
  label?: React.ReactNode;
  /** Shows the mixed state (e.g. "some rows selected"). */
  indeterminate?: boolean;
}

/** Checkbox for picking options. For on/off settings use Switch. */
export function Checkbox({ checked, onChange, label, indeterminate = false, disabled, className, ...rest }: CheckboxProps) {
  const ref = React.useRef<HTMLInputElement | null>(null);
  React.useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return (
    <label className={cx('ui-check', disabled && 'ui-check--disabled', className)}>
      <input
        ref={ref}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        aria-checked={indeterminate ? 'mixed' : checked}
        onChange={(e) => onChange(e.target.checked)}
        {...rest}
      />
      {label && <span>{label}</span>}
    </label>
  );
}

export default Checkbox;
