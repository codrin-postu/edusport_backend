import * as React from 'react';
import { cx } from './cx';
import { useFieldControl } from './Field';

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

/** Text input. Inside a Field it picks up id, aria and required automatically. */
export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input({ className, type = 'text', ...props }, ref) {
  const p = useFieldControl(props);
  return <input ref={ref} type={type} className={cx('adm-input', className)} {...p} />;
});

export default Input;
