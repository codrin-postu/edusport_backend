import * as React from 'react';
import { cx } from './cx';

export interface SegmentOption<V extends string = string> {
  value: V;
  label: React.ReactNode;
  disabled?: boolean;
}

export interface SegmentedControlProps<V extends string = string> {
  /** 2 to 4 options. */
  options: SegmentOption<V>[];
  value: V;
  onChange: (value: V) => void;
  /** Accessible name of the group (required when no visible label points at it). */
  'aria-label'?: string;
  'aria-labelledby'?: string;
  size?: 'sm' | 'md';
  /** Stretch to the container width, options share it equally. */
  block?: boolean;
  disabled?: boolean;
  className?: string;
}

/**
 * One choice out of 2 to 4, as a row of square segments; the selected one is
 * filled with the accent. role="radiogroup" with roving focus: Tab enters on
 * the selected option, arrows move and select (skipping disabled ones).
 * Replaces the legacy .pubseg and VideoEmbedEditor's Radio.Group.
 */
export function SegmentedControl<V extends string = string>({
  options,
  value,
  onChange,
  size = 'md',
  block = false,
  disabled = false,
  className,
  ...aria
}: SegmentedControlProps<V>) {
  const refs = React.useRef<Array<HTMLButtonElement | null>>([]);
  const selected = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );

  const go = (from: number, dir: 1 | -1) => {
    for (let k = 1; k <= options.length; k++) {
      const i = (from + dir * k + options.length) % options.length;
      if (!options[i].disabled) {
        onChange(options[i].value);
        refs.current[i]?.focus();
        return;
      }
    }
  };

  return (
    <div
      role="radiogroup"
      aria-label={aria['aria-label']}
      aria-labelledby={aria['aria-labelledby']}
      aria-disabled={disabled || undefined}
      className={cx('adm-root', 'adm-seg', size === 'sm' && 'adm-seg--sm', block && 'adm-seg--block', className)}
    >
      {options.map((o, i) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={i === selected ? 0 : -1}
            disabled={disabled || o.disabled}
            className="adm-seg-opt"
            onClick={() => {
              if (!on) onChange(o.value);
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                e.preventDefault();
                go(i, 1);
              } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                e.preventDefault();
                go(i, -1);
              }
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export default SegmentedControl;
