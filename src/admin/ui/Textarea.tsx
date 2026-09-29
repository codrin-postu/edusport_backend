import * as React from 'react';
import { cx } from './cx';
import { useFieldControl } from './Field';

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

/** Multi-line input. Inside a Field it picks up id, aria and required automatically. */
export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea({ className, rows = 3, ...props }, ref) {
  const p = useFieldControl(props);
  return <textarea ref={ref} rows={rows} className={cx('adm-input', className)} {...p} />;
});

export default Textarea;
