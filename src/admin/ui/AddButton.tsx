import * as React from 'react';
import { cx } from './cx';
import { IconPlus } from './icons';

export interface AddButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  /** Text after the plus, e.g. "Adaugă regulă". */
  label: React.ReactNode;
}

/**
 * Full-width "+ label" button at the end of a list. Replaces the plugin's
 * components/AddListButton (raw Strapi purple) with the admin accent.
 */
export const AddButton = React.forwardRef<HTMLButtonElement, AddButtonProps>(function AddButton(
  { label, className, type = 'button', ...rest },
  ref,
) {
  return (
    <button ref={ref} type={type} className={cx('ui-add', className)} {...rest}>
      <IconPlus />
      {label}
    </button>
  );
});

export default AddButton;
