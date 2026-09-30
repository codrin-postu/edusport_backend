import * as React from 'react';
import { cx } from './cx';
import { useFieldControl } from './Field';
import { IconChevronDown, IconChevronUp } from './icons';

export interface NumberInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange' | 'min' | 'max' | 'step' | 'size'> {
  /** null for empty. */
  value: number | null;
  onChange: (value: number | null) => void;
  min?: number;
  max?: number;
  /** Default 1. Decimals are allowed when step is not a whole number. */
  step?: number;
  /** Past max goes to min and back (clock spinners). Default false. */
  wrap?: boolean;
  /** Left-pad with zeros to this many digits ("05"). */
  pad?: number;
  /** Empty text commits null. Default true; false falls back to the last value. */
  allowEmpty?: boolean;
  /** 'lg' is the big centred spinner of the time popover. */
  size?: 'md' | 'lg';
  /** Used for the step buttons: "Crește <label>" / "Scade <label>". Also the aria-label when there is no Field. */
  label?: string;
}

const decimalsOf = (n: number) => {
  const s = String(n);
  const i = s.indexOf('.');
  return i < 0 ? 0 : s.length - i - 1;
};

/**
 * Number field with a stepper: text input (no native spin buttons), up / down
 * buttons, ArrowUp / ArrowDown step, PageUp / PageDown step x10, Home / End
 * jump to min / max. The typed text is committed on blur or Enter (so "23"
 * can be typed without being re-padded after the "2"); Escape drops it.
 * Port of the plugin's components/SpinnerInput, on tokens.
 */
export const NumberInput = React.forwardRef<HTMLInputElement, NumberInputProps>(function NumberInput(
  {
    value,
    onChange,
    min,
    max,
    step = 1,
    wrap = false,
    pad,
    allowEmpty = true,
    size = 'md',
    label,
    className,
    disabled,
    onBlur,
    onFocus,
    onKeyDown,
    ...props
  },
  ref,
) {
  const p = useFieldControl(props);
  const [draft, setDraft] = React.useState<string | null>(null);
  const decimals = decimalsOf(step);

  const fmt = (n: number | null) => {
    if (n === null || Number.isNaN(n)) return '';
    const s = decimals ? n.toFixed(decimals) : String(Math.round(n));
    return pad && !decimals && n >= 0 ? s.padStart(pad, '0') : s;
  };

  const clamp = (n: number) => {
    let v = n;
    if (min !== undefined && v < min) v = min;
    if (max !== undefined && v > max) v = max;
    return decimals ? Number(v.toFixed(decimals)) : v;
  };

  const stepBy = (dir: 1 | -1, times = 1) => {
    if (disabled) return;
    setDraft(null);
    const base = value ?? (dir > 0 ? (min ?? 0) - step : (max ?? 0) + step);
    let next = base + dir * step * times;
    if (wrap && min !== undefined && max !== undefined) {
      if (next > max) next = min;
      else if (next < min) next = max;
    }
    next = clamp(next);
    if (next !== value) onChange(next);
  };

  const commit = () => {
    if (draft === null) return;
    const raw = draft.trim().replace(',', '.');
    setDraft(null);
    if (raw === '' || raw === '-') {
      if (allowEmpty && value !== null) onChange(null);
      return;
    }
    const n = Number(raw);
    if (Number.isNaN(n)) return;
    const next = clamp(n);
    if (next !== value) onChange(next);
  };

  const pattern = decimals ? /^-?\d*([.,]\d*)?$/ : /^-?\d*$/;
  const upOff = disabled || (!wrap && max !== undefined && value !== null && value >= max);
  const downOff = disabled || (!wrap && min !== undefined && value !== null && value <= min);

  return (
    <span className={cx('ui-root', 'ui-numin', size === 'lg' && 'ui-numin--lg', className)}>
      <input
        ref={ref}
        type="text"
        inputMode={decimals ? 'decimal' : 'numeric'}
        autoComplete="off"
        role="spinbutton"
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value ?? undefined}
        className="ui-input"
        disabled={disabled}
        {...p}
        aria-label={props['aria-label'] ?? (p.id !== props.id ? undefined : label)}
        value={draft ?? fmt(value)}
        onChange={(e) => {
          if (pattern.test(e.target.value)) setDraft(e.target.value);
        }}
        onFocus={(e) => {
          e.target.select();
          onFocus?.(e);
        }}
        onBlur={(e) => {
          commit();
          onBlur?.(e);
        }}
        onKeyDown={(e) => {
          onKeyDown?.(e);
          if (e.defaultPrevented) return;
          if (e.key === 'Enter') {
            commit();
          } else if (e.key === 'Escape' && draft !== null) {
            e.preventDefault();
            setDraft(null);
          } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
            stepBy(e.key === 'ArrowUp' ? 1 : -1);
          } else if (e.key === 'PageUp' || e.key === 'PageDown') {
            e.preventDefault();
            stepBy(e.key === 'PageUp' ? 1 : -1, 10);
          } else if (e.key === 'Home' && min !== undefined) {
            e.preventDefault();
            setDraft(null);
            if (value !== min) onChange(min);
          } else if (e.key === 'End' && max !== undefined) {
            e.preventDefault();
            setDraft(null);
            if (value !== max) onChange(max);
          }
        }}
      />
      <span className="ui-numin-steps">
        <button type="button" tabIndex={-1} aria-label={`Crește ${label ?? 'valoarea'}`} disabled={upOff} onClick={() => stepBy(1)}>
          <IconChevronUp size={size === 'lg' ? 12 : 10} />
        </button>
        <button type="button" tabIndex={-1} aria-label={`Scade ${label ?? 'valoarea'}`} disabled={downOff} onClick={() => stepBy(-1)}>
          <IconChevronDown size={size === 'lg' ? 12 : 10} />
        </button>
      </span>
    </span>
  );
});

export default NumberInput;
