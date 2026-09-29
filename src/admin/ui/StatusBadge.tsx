import * as React from 'react';
import { cx } from './cx';
import type { StatusTone } from './tokens';

export type BadgeTone = StatusTone | 'accent';

/** Colours from content config (e.g. a status defined in a form). */
export interface CustomBadgeColors {
  fg: string;
  bg: string;
  line?: string;
}

export interface StatusBadgeProps {
  tone?: BadgeTone;
  /** Overrides `tone` when set. */
  custom?: CustomBadgeColors;
  size?: 'sm' | 'md';
  children: React.ReactNode;
  title?: string;
  className?: string;
}

/** Square status label (4px corners, never a pill). */
export function StatusBadge({ tone = 'neutral', custom, size = 'sm', children, title, className }: StatusBadgeProps) {
  const style = custom
    ? ({
        '--adm-badge-fg': custom.fg,
        '--adm-badge-bg': custom.bg,
        '--adm-badge-line': custom.line ?? custom.bg,
      } as React.CSSProperties)
    : undefined;
  return (
    <span className={cx('adm-badge', `adm-badge--${size}`, !custom && `adm-badge--${tone}`, className)} style={style} title={title}>
      {children}
    </span>
  );
}

export default StatusBadge;
