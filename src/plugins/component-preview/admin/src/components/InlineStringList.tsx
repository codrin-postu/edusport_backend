import * as React from 'react';
import { Flex, Textarea, TextInput, Typography } from '@strapi/design-system';
import { Plus, Trash } from '@strapi/icons';
import { useMatchMedia } from '../utils/useMatchMedia';

interface InlineStringListProps {
  items: string[];
  onChange: (next: string[]) => void;
  idPrefix: string;
  ariaItemLabel: string;
  addLabel: string;
  itemPlaceholder?: string;
  emptyLabel?: string;
  rows?: number;
}

export function InlineStringList({
  items,
  onChange,
  idPrefix,
  ariaItemLabel,
  addLabel,
  itemPlaceholder = '',
  emptyLabel = 'Niciun element adăugat',
  rows = 2,
}: InlineStringListProps) {
  const isMobile = useMatchMedia('(max-width: 640px)');

  const update = (i: number, val: string) => {
    const next = [...items];
    next[i] = val;
    onChange(next);
  };
  const add = () => onChange([...items, '']);
  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i));

  const deleteButtonBase: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: 'none',
    borderLeft: '1px solid #dcdce4',
    background: '#fcecea',
    color: '#d02b20',
    cursor: 'pointer',
  };

  const renderInput = (text: string, i: number) =>
    rows === 1 ? (
      <TextInput
        id={`${idPrefix}-${i}`}
        name={`${idPrefix}-${i}`}
        aria-label={`${ariaItemLabel} ${i + 1}`}
        value={text}
        placeholder={itemPlaceholder}
        style={isMobile ? undefined : { paddingRight: 40 }}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => update(i, e.target.value)}
      />
    ) : (
      <Textarea
        id={`${idPrefix}-${i}`}
        name={`${idPrefix}-${i}`}
        aria-label={`${ariaItemLabel} ${i + 1}`}
        value={text}
        rows={rows}
        placeholder={itemPlaceholder}
        style={isMobile ? undefined : { paddingRight: 40 }}
        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => update(i, e.target.value)}
      />
    );

  return (
    <Flex direction="column" gap={2} alignItems="stretch">
      {items.length === 0 ? (
        <Typography variant="omega" textColor="neutral500" style={{ padding: '8px 0', fontStyle: 'italic' }}>
          {emptyLabel}
        </Typography>
      ) : (
        items.map((text, i) =>
          isMobile ? (
            <div key={i}>
              {renderInput(text, i)}
              <button
                type="button"
                onClick={() => remove(i)}
                aria-label={`Șterge ${ariaItemLabel.toLowerCase()} ${i + 1}`}
                style={{
                  ...deleteButtonBase,
                  width: '100%',
                  padding: '6px 0',
                  marginTop: 4,
                  borderLeft: 'none',
                  borderRadius: 4,
                  borderTop: '1px solid #dcdce4',
                  gap: 6,
                  fontSize: 13,
                  fontWeight: 500,
                  fontFamily: 'inherit',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#f8d0cc'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = '#fcecea'; }}
              >
                <Trash aria-hidden />
                Șterge
              </button>
            </div>
          ) : (
            <div key={i} style={{ position: 'relative' }}>
              {renderInput(text, i)}
              <button
                type="button"
                onClick={() => remove(i)}
                aria-label={`Șterge ${ariaItemLabel.toLowerCase()} ${i + 1}`}
                style={{
                  ...deleteButtonBase,
                  position: 'absolute',
                  top: 1,
                  right: 1,
                  bottom: 1,
                  width: 36,
                  borderRadius: '0 3px 3px 0',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#f8d0cc'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = '#fcecea'; }}
              >
                <Trash aria-hidden />
              </button>
            </div>
          )
        )
      )}

      <button
        type="button"
        onClick={add}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          width: '100%',
          padding: '10px 16px',
          border: '1px solid #d9d8ff',
          borderRadius: 4,
          background: '#ffffff',
          color: '#4945ff',
          fontSize: 13,
          fontWeight: 600,
          fontFamily: 'inherit',
          cursor: 'pointer',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = '#f0f0ff'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = '#ffffff'; }}
      >
        <Plus aria-hidden />
        {addLabel}
      </button>
    </Flex>
  );
}
