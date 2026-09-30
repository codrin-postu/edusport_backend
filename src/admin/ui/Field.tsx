import * as React from 'react';
import { cx } from './cx';

/**
 * Form field wrapper: label, required mark, hint and an inline error, with the
 * ids and aria attributes wired to the control inside.
 *
 * The control (Input, Textarea, Select, DateInput) reads the context below, so
 *   <Field label="Nume" required error={errors.name}><Input value=... /></Field>
 * gets id, aria-describedby, aria-invalid and required without extra props.
 */

export interface FieldContextValue {
  id: string;
  describedBy: string | undefined;
  invalid: boolean;
  required: boolean;
}

/** The attributes a Field hands to its control. */
export interface FieldAria {
  id?: string;
  required?: boolean;
  'aria-describedby'?: string;
  'aria-invalid'?: React.AriaAttributes['aria-invalid'];
}

const FieldContext = React.createContext<FieldContextValue | null>(null);

/** Control-side hook: merges the field context into the control's own props. */
export function useFieldControl<P extends { id?: string; required?: boolean; 'aria-describedby'?: string; 'aria-invalid'?: React.AriaAttributes['aria-invalid'] }>(props: P): P {
  const ctx = React.useContext(FieldContext);
  if (!ctx) return props;
  const describedBy = [ctx.describedBy, props['aria-describedby']].filter(Boolean).join(' ') || undefined;
  return {
    ...props,
    id: props.id ?? ctx.id,
    required: props.required ?? (ctx.required || undefined),
    'aria-describedby': describedBy,
    'aria-invalid': props['aria-invalid'] ?? (ctx.invalid || undefined),
  };
}

export interface FieldProps {
  label: React.ReactNode;
  /** Shown under the control, muted. */
  hint?: React.ReactNode;
  /** Inline error under the control; also marks the control aria-invalid. */
  error?: React.ReactNode;
  required?: boolean;
  /** Control id; generated when omitted. */
  id?: string;
  /** Visually hide the label (it stays for screen readers). */
  hideLabel?: boolean;
  className?: string;
  children: React.ReactNode;
}

export function Field({ label, hint, error, required = false, id, hideLabel, className, children }: FieldProps) {
  const auto = React.useId();
  const controlId = id ?? `ui-f${auto.replace(/:/g, '')}`;
  const hintId = hint ? `${controlId}-hint` : undefined;
  const errId = error ? `${controlId}-err` : undefined;
  const ctx = React.useMemo<FieldContextValue>(
    () => ({
      id: controlId,
      describedBy: [errId, hintId].filter(Boolean).join(' ') || undefined,
      invalid: Boolean(error),
      required,
    }),
    [controlId, errId, hintId, error, required],
  );
  return (
    <div className={cx('ui-field', className)}>
      <label htmlFor={controlId} className={cx('ui-label', hideLabel && 'ui-sr')}>
        {label}
        {required && (
          <span className="ui-req" aria-hidden="true">
            *
          </span>
        )}
      </label>
      <FieldContext.Provider value={ctx}>{children}</FieldContext.Provider>
      {error && (
        <div id={errId} className="ui-error" role="alert">
          {error}
        </div>
      )}
      {hint && (
        <div id={hintId} className="ui-hint">
          {hint}
        </div>
      )}
    </div>
  );
}

/** Two fields side by side, stacked on phones. */
export function FieldRow({ children }: { children: React.ReactNode }) {
  return <div className="ui-grid2">{children}</div>;
}

export default Field;
