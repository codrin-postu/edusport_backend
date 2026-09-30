import * as React from 'react';
import { cx } from './cx';
import { EditorCard } from './EditorCard';
import { Field } from './Field';
import { Input } from './Input';
import { Textarea } from './Textarea';
import { Select, type SelectOption } from './Select';
import { DateInput } from './DateInput';
import { NumberInput } from './NumberInput';
import { TimeInput } from './TimeInput';

/**
 * Declarative editor for a flat object (a banner, a page intro, contact
 * details): title + description + a list of fields, in a 2-column grid on
 * wide screens, optionally grouped into titled sections.
 *
 *   const obj = useObjectField(field.value, (v) => field.onChange(name, v), EMPTY);
 *   <ObjectFieldCard
 *     title="Banner pagină"
 *     description="Titlul și subtitlul din partea de sus a paginii."
 *     value={obj.data}
 *     onFieldChange={obj.update}
 *     fields={[
 *       { key: 'title', label: 'Titlu', placeholder: 'ex: Echipa noastră', span: 2 },
 *       { key: 'subtitle', label: 'Subtitlu', type: 'textarea', rows: 3, span: 2 },
 *     ]}
 *   />
 *
 * Value shapes: text / textarea / url / select / date use strings (date:
 * "YYYY-MM-DD"; empty date is null), time "HH:MM" or null, number a number
 * or null.
 */

export type ObjectFieldType = 'text' | 'textarea' | 'url' | 'number' | 'date' | 'time' | 'select';

export interface ObjectFieldConfig<T> {
  key: keyof T & string;
  label: React.ReactNode;
  hint?: React.ReactNode;
  /** Default 'text'. */
  type?: ObjectFieldType;
  /** For 'select'. */
  options?: SelectOption[];
  placeholder?: string;
  /** For 'textarea'. Default 3. */
  rows?: number;
  /** Grid columns taken on wide screens. Default 1 (textarea: 2). */
  span?: 1 | 2;
  required?: boolean;
  /** For 'number'. */
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  /** Error under the field. */
  error?: React.ReactNode;
}

export interface ObjectFieldSection<T> {
  title?: React.ReactNode;
  keys: Array<keyof T & string>;
}

export interface ObjectFieldCardProps<T extends object> {
  title: React.ReactNode;
  description?: React.ReactNode;
  headerAction?: React.ReactNode;
  value: T;
  onFieldChange: <K extends keyof T>(key: K, value: T[K]) => void;
  fields: ObjectFieldConfig<T>[];
  /** Group fields under titles; fields not listed in any section are left out. */
  sections?: ObjectFieldSection<T>[];
  /** Extra content under the fields (e.g. a GalleryGrid or a Notice). */
  children?: React.ReactNode;
  disabled?: boolean;
  className?: string;
}

function FieldControl<T extends object>({
  cfg,
  value,
  onChange,
  disabled,
}: {
  cfg: ObjectFieldConfig<T>;
  value: unknown;
  onChange: (v: unknown) => void;
  disabled?: boolean;
}) {
  const off = disabled || cfg.disabled;
  const str = value === null || value === undefined ? '' : String(value);
  switch (cfg.type ?? 'text') {
    case 'textarea':
      return <Textarea value={str} rows={cfg.rows ?? 3} placeholder={cfg.placeholder} disabled={off} onChange={(e) => onChange(e.target.value)} />;
    case 'url':
      return (
        <Input type="url" inputMode="url" value={str} placeholder={cfg.placeholder ?? 'https://'} disabled={off} onChange={(e) => onChange(e.target.value)} />
      );
    case 'number':
      return (
        <NumberInput
          value={typeof value === 'number' ? value : str === '' ? null : Number(str)}
          min={cfg.min}
          max={cfg.max}
          step={cfg.step}
          placeholder={cfg.placeholder}
          disabled={off}
          onChange={onChange}
        />
      );
    case 'date':
      return <DateInput value={str || null} disabled={off} onChange={onChange} />;
    case 'time':
      return <TimeInput value={str || null} placeholder={cfg.placeholder} disabled={off} onChange={onChange} />;
    case 'select':
      return <Select value={str} options={cfg.options} placeholder={cfg.placeholder ?? 'Alege'} disabled={off} onChange={(v) => onChange(v)} />;
    default:
      return <Input value={str} placeholder={cfg.placeholder} disabled={off} onChange={(e) => onChange(e.target.value)} />;
  }
}

export function ObjectFieldCard<T extends object>({
  title,
  description,
  headerAction,
  value,
  onFieldChange,
  fields,
  sections,
  children,
  disabled,
  className,
}: ObjectFieldCardProps<T>) {
  const byKey = new Map(fields.map((f) => [f.key, f]));
  const groups: ObjectFieldSection<T>[] = sections ?? [{ keys: fields.map((f) => f.key) }];

  const grid = (keys: Array<keyof T & string>) => (
    <div className="ui-ofc-grid">
      {keys.map((k) => {
        const cfg = byKey.get(k);
        if (!cfg) return null;
        const span = cfg.span ?? (cfg.type === 'textarea' ? 2 : 1);
        return (
          <Field key={k} label={cfg.label} hint={cfg.hint} required={cfg.required} error={cfg.error} className={cx(span === 2 && 'ui-ofc-span2')}>
            <FieldControl<T>
              cfg={cfg}
              value={(value as Record<string, unknown>)[k]}
              disabled={disabled}
              onChange={(v) => onFieldChange(k, v as T[typeof k])}
            />
          </Field>
        );
      })}
    </div>
  );

  return (
    <EditorCard title={title} description={description} headerAction={headerAction} className={className}>
      <div className="ui-ofc">
        {groups.map((g, i) => (
          <div key={i} className="ui-ofc-sec">
            {g.title && <h4 className="ui-ofc-sec-title">{g.title}</h4>}
            {grid(g.keys)}
          </div>
        ))}
        {children}
      </div>
    </EditorCard>
  );
}

export default ObjectFieldCard;
