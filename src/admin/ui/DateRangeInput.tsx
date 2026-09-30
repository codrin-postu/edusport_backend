import * as React from 'react';
import { cx } from './cx';
import { Field } from './Field';
import { DateInput } from './DateInput';

export interface DateRange {
  /** ISO "YYYY-MM-DD" (or "YYYY-MM-DDTHH:mm" with withTime), null for empty. */
  start: string | null;
  end: string | null;
}

export interface DateRangeInputProps {
  value: DateRange;
  onChange: (next: DateRange) => void;
  startLabel?: React.ReactNode;
  endLabel?: React.ReactNode;
  /** One line under the pair. */
  hint?: React.ReactNode;
  /** Error for the pair (under the end field) or per field. */
  error?: React.ReactNode | { start?: React.ReactNode; end?: React.ReactNode };
  required?: boolean;
  withTime?: boolean;
  disabled?: boolean;
  className?: string;
}

const key = (v: string | null, withTime: boolean) => (v ? v.slice(0, withTime ? 16 : 10) : null);

const isPairError = (e: DateRangeInputProps['error']): e is { start?: React.ReactNode; end?: React.ReactNode } =>
  !!e && typeof e === 'object' && !React.isValidElement(e) && ('start' in e || 'end' in e);

/**
 * Start and end date on two DateInputs, kept in order: each field's picker
 * is bounded by the other (min / max), a start moved past the end drags the
 * end with it, and an end set before the start snaps to the start. So
 * end >= start always holds. Side by side, stacked on phones.
 */
export function DateRangeInput({
  value,
  onChange,
  startLabel = 'Data de început',
  endLabel = 'Data de sfârșit',
  hint,
  error,
  required = false,
  withTime = false,
  disabled = false,
  className,
}: DateRangeInputProps) {
  const start = key(value.start, withTime);
  const end = key(value.end, withTime);
  const pair = isPairError(error) ? error : { start: undefined, end: error as React.ReactNode };

  return (
    <div className={cx('adm-root', 'adm-range', className)}>
      <div className="adm-grid2">
        <Field label={startLabel} required={required} error={pair.start}>
          <DateInput
            value={start}
            withTime={withTime}
            disabled={disabled}
            max={end ?? undefined}
            onChange={(s) => onChange({ start: s, end: s && end && end < s ? s : end })}
          />
        </Field>
        <Field label={endLabel} required={required} error={pair.end}>
          <DateInput
            value={end}
            withTime={withTime}
            disabled={disabled}
            min={start ?? undefined}
            onChange={(e) => onChange({ start, end: e && start && e < start ? start : e })}
          />
        </Field>
      </div>
      {hint && <div className="adm-hint">{hint}</div>}
    </div>
  );
}

export default DateRangeInput;
