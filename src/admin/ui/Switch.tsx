import * as React from 'react';
import { cx } from './cx';

export interface SwitchProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  /** Visible label. Pass `aria-label` instead when there is none. */
  label?: React.ReactNode;
  /** Muted second line under the label. */
  description?: React.ReactNode;
  disabled?: boolean;
  id?: string;
  'aria-label'?: string;
  className?: string;
}

/**
 * On/off control for settings (not for picking options, use Checkbox there).
 * A native button with role="switch": Space and Enter toggle it.
 */
export function Switch({ checked, onChange, label, description, disabled, id, className, ...aria }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      aria-label={aria['aria-label']}
      disabled={disabled}
      className={cx('ui-switch', className)}
      onClick={() => onChange(!checked)}
    >
      <span className="ui-switch-track" aria-hidden="true">
        <span className="ui-switch-thumb" />
      </span>
      {(label || description) && (
        <span className="ui-switch-text">
          {label && <span>{label}</span>}
          {description && <span className="ui-switch-desc">{description}</span>}
        </span>
      )}
    </button>
  );
}

export default Switch;
