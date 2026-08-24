import * as React from 'react';
import { useField } from '@strapi/admin/strapi-admin';
import { Box, Typography } from '@strapi/design-system';

interface Props {
  name: string;
  attribute: Record<string, unknown>;
  label?: string;
  hint?: string;
  required?: boolean;
  placeholder?: string;
}

function parseValue(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((x) => typeof x === 'string');
  if (typeof v === 'string' && v.trim()) {
    try {
      const p = JSON.parse(v);
      return Array.isArray(p) ? p.filter((x: unknown) => typeof x === 'string') : [];
    } catch {
      return [];
    }
  }
  return [];
}

export default function TagsInput({ name, attribute, label, hint, required }: Props) {
  const field = useField<unknown>(name);
  const [tags, setTags] = React.useState<string[]>(() => parseValue(field.value));
  const [input, setInput] = React.useState('');

  React.useEffect(() => {
    setTags(parseValue(field.value));
  }, [field.value]);

  const commit = (next: string[]) => {
    setTags(next);
    field.onChange(name, next);
  };

  const addTag = () => {
    const val = input.trim();
    if (!val || tags.includes(val)) return;
    commit([...tags, val]);
    setInput('');
  };

  const removeTag = (i: number) => commit(tags.filter((_, idx) => idx !== i));

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); addTag(); }
    if (e.key === 'Backspace' && !input && tags.length) removeTag(tags.length - 1);
  };

  const placeholder = (attribute as any)?.options?.placeholder ?? 'Adaugă și apasă Enter…';

  return (
    <div>
      {label && (
        <label style={{
          display: 'block',
          fontSize: 12,
          fontWeight: 600,
          color: 'var(--strapi-neutral800, #32324d)',
          marginBottom: 4,
        }}>
          {label}{required && ' *'}
        </label>
      )}
    <div style={{
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 6,
      minHeight: 40,
      padding: '6px 10px',
      border: '1px solid var(--strapi-neutral200, #dcdce4)',
      borderRadius: 4,
      background: 'var(--strapi-neutral0, #fff)',
      cursor: 'text',
    }}
      onClick={() => (document.getElementById(`tags-input-${name}`) as HTMLInputElement)?.focus()}
    >
      {tags.map((tag, i) => (
        <span key={i} style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          padding: '2px 8px',
          borderRadius: 12,
          background: 'var(--strapi-primary100, #eaf5ff)',
          border: '1px solid var(--strapi-primary200, #b8dcff)',
          fontSize: 13,
          color: 'var(--strapi-primary600, #0c75af)',
          whiteSpace: 'nowrap',
        }}>
          {tag}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); removeTag(i); }}
            style={{
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              padding: '0 2px',
              fontSize: 14,
              lineHeight: 1,
              color: 'var(--strapi-primary400, #66b7f1)',
            }}
            aria-label={`Șterge ${tag}`}
          >
            ×
          </button>
        </span>
      ))}
      <input
        id={`tags-input-${name}`}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={addTag}
        placeholder={tags.length === 0 ? placeholder : ''}
        style={{
          flex: '1 1 120px',
          minWidth: 80,
          border: 'none',
          outline: 'none',
          background: 'transparent',
          fontSize: 14,
          color: 'var(--strapi-neutral800, #32324d)',
          padding: '2px 0',
        }}
      />
    </div>
    {hint && (
      <p style={{ fontSize: 11, color: 'var(--strapi-neutral500, #8e8ea9)', marginTop: 4 }}>
        {hint}
      </p>
    )}
    </div>
  );
}
