import * as React from 'react';
import { Plus } from '@strapi/icons';

// Full-width "+ label" button matching the InlineStringList pattern used
// elsewhere in the admin (e.g. "Adaugă realizare"). Standardised so every list
// section across the editors gets the same end-of-list affordance.
export function AddListButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
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
      {label}
    </button>
  );
}
