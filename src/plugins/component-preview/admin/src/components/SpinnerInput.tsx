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

  const clamp = (n: number) => Math.max(min, Math.min(max, n));
  const pad = (n: number) => String(n).padStart(2, '0');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const n = parseInt(e.target.value, 10);
    if (!isNaN(n)) onChange(clamp(n));
  };

  return (
    <div style={{ position: 'relative', width: '64px' }} aria-label={label}>
      <NoSpinInput
        type="number"
        min={min}
        max={max}
        value={pad(value)}
        onChange={handleChange}
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
