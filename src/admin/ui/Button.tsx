import * as React from 'react';
import { cx } from './cx';
import { Spinner } from './Spinner';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
export type ButtonSize = 'sm' | 'md';

interface BaseProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  /** Default 'primary'. Pass 'secondary' for the outlined look, 'ghost' for text-only. */
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Shows a spinner, sets aria-busy and blocks clicks. */
  loading?: boolean;
  /** Leading icon (an inline SVG or Strapi icon element). */
  icon?: React.ReactNode;
}

/** Text button: children required. */
interface TextButtonProps extends BaseProps {
  children: React.ReactNode;
  iconOnly?: false;
}

/** Icon-only button: aria-label required, no children. */
interface IconButtonProps extends BaseProps {
  iconOnly: true;
  icon: React.ReactNode;
  'aria-label': string;
  children?: never;
}

export type ButtonProps = TextButtonProps | IconButtonProps;

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading = false, icon, iconOnly, className, disabled, children, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cx(
        'ui-btn',
        `ui-btn--${variant}`,
        size === 'sm' && 'ui-btn--sm',
        iconOnly && 'ui-btn--icon',
        className,
      )}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      title={iconOnly ? rest['aria-label'] : rest.title}
      {...rest}
    >
      {loading ? <Spinner size={14} /> : icon}
      {!iconOnly && children}
    </button>
  );
});

export default Button;
