import * as React from 'react';
import styled, { useTheme } from 'styled-components';
import { ChevronDown, ChevronUp } from '@strapi/icons';
import type { StrapiTheme } from '@strapi/design-system';

const NoSpinInput = styled.input`
  &::-webkit-inner-spin-button,
  &::-webkit-outer-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
  -moz-appearance: textfield;
`;

interface SpinnerInputProps {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  /** Accessible label - used for the field's aria-label and the inc/dec button labels. */
  label: string;
}

/** Two-digit number input with embedded up/down chevrons. Wraps min↔max. */
export function SpinnerInput({ value, min, max, onChange, label }: SpinnerInputProps) {
  const theme = useTheme() as StrapiTheme;
  // Raw text while the field is being typed into. null means "show the value".
  // Re-padding on every keystroke made two-digit values like 23 unenterable.
  const [draft, setDraft] = React.useState<string | null>(null);

  const clamp = (n: number) => Math.max(min, Math.min(max, n));
  const pad = (n: number) => String(n).padStart(2, '0');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (!/^\d{0,2}$/.test(raw)) return;
    setDraft(raw);
  };

  // Commit on blur. Empty or unparsable text falls back to the current value.
  const commit = () => {
    if (draft === null) return;
    const n = parseInt(draft, 10);
    setDraft(null);
    if (!isNaN(n)) onChange(clamp(n));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commit();
    } else if (e.key === 'Escape') {
      setDraft(null);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setDraft(null);
      onChange(value < max ? value + 1 : min);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setDraft(null);
      onChange(value > min ? value - 1 : max);
    }
  };

  return (
    <div style={{ position: 'relative', width: '64px' }} aria-label={label}>
      <NoSpinInput
        type="text"
        inputMode="numeric"
        autoComplete="off"
        maxLength={2}
        role="spinbutton"
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        value={draft ?? pad(value)}
        onChange={handleChange}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        onFocus={(e) => e.target.select()}
        aria-label={label}
        style={{
          width: '100%',
          height: '44px',
          paddingRight: '22px',
          textAlign: 'center',
          border: `1px solid ${theme.colors.neutral200}`,
          borderRadius: theme.borderRadius,
          background: theme.colors.neutral0,
          color: theme.colors.neutral800,
          fontSize: '1.8rem',
          fontFamily: 'inherit',
          fontWeight: 700,
          outline: 'none',
          boxSizing: 'border-box',
        }}
      />
      <div
        style={{
          position: 'absolute',
          right: 0,
          top: 0,
          bottom: 0,
          width: '22px',
          display: 'flex',
          flexDirection: 'column',
          borderLeft: `1px solid ${theme.colors.neutral200}`,
          borderRadius: `0 ${theme.borderRadius} ${theme.borderRadius} 0`,
          overflow: 'hidden',
        }}
      >
        <button
          type="button"
          onClick={() => onChange(value < max ? value + 1 : min)}
          aria-label={`Crește ${label}`}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: theme.colors.neutral100,
            color: theme.colors.neutral500,
            border: 'none',
            borderBottom: `1px solid ${theme.colors.neutral200}`,
            cursor: 'pointer',
            padding: 0,
          }}
        >
          <ChevronUp style={{ width: 10, height: 10 }} />
        </button>
        <button
          type="button"
          onClick={() => onChange(value > min ? value - 1 : max)}
          aria-label={`Scade ${label}`}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: theme.colors.neutral100,
            color: theme.colors.neutral500,
            border: 'none',
            cursor: 'pointer',
            padding: 0,
          }}
        >
          <ChevronDown style={{ width: 10, height: 10 }} />
        </button>
      </div>
    </div>
  );
}
