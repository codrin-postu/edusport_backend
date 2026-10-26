import * as React from 'react';
import { cx } from './cx';

export interface RadioProps {
  /** Shared by the radios of one group: arrow keys move inside it. */
  name: string;
  value: string;
  checked: boolean;
  onChange: () => void;
  label: React.ReactNode;
  /** Muted line(s) under the label. */
  hint?: React.ReactNode;
  disabled?: boolean;
  /** Choice card (prototype v5 confirm window): bordered box, bold label, hint under it. */
  card?: boolean;
  className?: string;
}

/** One admin radio (DECISIONS 2026-10-06 open-questions-v2 Q8): a native input with the admin mark. */
export function Radio({ name, value, checked, onChange, label, hint, disabled = false, card = false, className }: RadioProps) {
  return (
    <label
      className={cx('ui-radio', card && 'ui-radio--card', disabled && 'ui-radio--disabled', className)}
      data-checked={checked || undefined}
    >
      <input type="radio" name={name} value={value} checked={checked} disabled={disabled} onChange={onChange} />
      <span className="ui-radio-text">
        <span className="ui-radio-label">{label}</span>
        {hint !== undefined && hint !== null && <span className="ui-radio-hint">{hint}</span>}
      </span>
    </label>
  );
}

export interface RadioOption<V extends string = string> {
  value: V;
  label: React.ReactNode;
  hint?: React.ReactNode;
  disabled?: boolean;
}

export interface RadioGroupProps<V extends string = string> {
  /** null = nothing chosen yet (a "Probabil" match: the admin must choose). */
  value: V | null;
  onChange: (value: V) => void;
  options: RadioOption<V>[];
  /** plain: mark + label. card: choice cards, two side by side, stacked on phones. Default plain. */
  variant?: 'plain' | 'card';
  /** Default 'row'; 'column' stacks the options (cards too). */
  direction?: 'row' | 'column';
  /** Input name; default a generated one. */
  name?: string;
  disabled?: boolean;
  className?: string;
  'aria-label'?: string;
  'aria-labelledby'?: string;
}

/** A group of admin radios: role radiogroup, one name, arrow keys move and choose. */
export function RadioGroup<V extends string = string>({
  value,
  onChange,
  options,
  variant = 'plain',
  direction = 'row',
  name,
  disabled = false,
  className,
  ...aria
}: RadioGroupProps<V>) {
  const autoName = React.useId();
  return (
    <div role="radiogroup" {...aria} className={cx('ui-radios', `ui-radios--${variant}`, `ui-radios--${direction}`, className)}>
      {options.map((o) => (
        <Radio
          key={o.value}
          name={name ?? autoName}
          value={o.value}
          checked={o.value === value}
          onChange={() => onChange(o.value)}
          label={o.label}
          hint={o.hint}
          disabled={disabled || o.disabled}
          card={variant === 'card'}
        />
      ))}
    </div>
  );
}

export default RadioGroup;
