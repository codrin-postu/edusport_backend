import * as React from 'react';
import { Flex, Textarea, TextInput, Typography } from '@strapi/design-system';
import { Trash } from '@strapi/icons';
import { AddButton } from '../../../../../admin/ui';
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

  // Danger colours from the admin tokens (the wrapper below is a .ui-root).
  const deleteButtonBase: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: 'none',
    borderLeft: '1px solid var(--theme-border)',
    background: 'var(--theme-danger-bg)',
    color: 'var(--theme-danger)',
    cursor: 'pointer',
  };
  const hoverOn = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.background = 'var(--theme-danger-border)';
  };
  const hoverOff = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.background = 'var(--theme-danger-bg)';
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
    // `.ui-root`: these editors render inside content-manager fields, outside
    // any page; the wrapper brings the --theme-* tokens and the AddButton styles.
    <div className="ui-root">
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
                    borderRadius: 'var(--ui-radius-sm)',
                    borderTop: '1px solid var(--theme-border)',
                    gap: 6,
                    fontSize: 13,
                    fontWeight: 500,
                    fontFamily: 'inherit',
                  }}
                  onMouseEnter={hoverOn}
                  onMouseLeave={hoverOff}
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
                    borderRadius: '0 calc(var(--ui-radius-sm) - 1px) calc(var(--ui-radius-sm) - 1px) 0',
                  }}
                  onMouseEnter={hoverOn}
                  onMouseLeave={hoverOff}
                >
                  <Trash aria-hidden />
                </button>
              </div>
            )
          )
        )}

        <AddButton label={addLabel} onClick={add} />
      </Flex>
    </div>
  );
}
