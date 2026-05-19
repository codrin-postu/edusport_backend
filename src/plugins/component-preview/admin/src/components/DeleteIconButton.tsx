import * as React from 'react';
import { useTheme } from 'styled-components';
import type { StrapiTheme } from '@strapi/design-system';
import { Trash } from '@strapi/icons';

export type DeleteIconButtonVariant = 'danger' | 'subtle';

interface DeleteIconButtonProps {
  onClick: () => void;
  label: string;
  /**
   * - `"danger"` - red icon on a soft red background by default; goes transparent on hover.
   * - `"subtle"` - transparent + muted gray icon by default; picks up the red tint on hover.
   */
  variant?: DeleteIconButtonVariant;
  /** Pixel size of the icon (default 20). The hit-area is 32×32 regardless. */
  iconSize?: number;
}

export function DeleteIconButton({
  onClick,
  label,
  variant = 'danger',
  iconSize = 20,
}: DeleteIconButtonProps) {
  const theme = useTheme() as StrapiTheme;

  const danger = {
    idleBg: theme.colors.danger100,
    idleColor: theme.colors.danger600,
    hoverBg: 'transparent',
    hoverColor: theme.colors.danger600,
  };
  const subtle = {
    idleBg: 'transparent',
    idleColor: theme.colors.neutral500,
    hoverBg: theme.colors.danger100,
    hoverColor: theme.colors.danger600,
  };
  const palette = variant === 'danger' ? danger : subtle;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 32,
        height: 32,
        border: 'none',
        background: palette.idleBg,
        color: palette.idleColor,
        cursor: 'pointer',
        borderRadius: 4,
        padding: 0,
        flexShrink: 0,
        transition: 'background 0.15s, color 0.15s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = palette.hoverBg;
        e.currentTarget.style.color = palette.hoverColor;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = palette.idleBg;
        e.currentTarget.style.color = palette.idleColor;
      }}
    >
      <Trash
        width={`${iconSize}px`}
        height={`${iconSize}px`}
        fill="currentColor"
        style={{ flexShrink: 0 }}
      />
    </button>
  );
}
