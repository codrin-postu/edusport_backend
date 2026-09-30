import * as React from 'react';
import { cx } from './cx';
import type { StatusTone } from './tokens';

export type BadgeTone = StatusTone | 'primary';

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
        '--ui-badge-fg': custom.fg,
        '--ui-badge-bg': custom.bg,
        '--ui-badge-border': custom.line ?? custom.bg,
      } as React.CSSProperties)
    : undefined;
  return (
    <span className={cx('ui-badge', `ui-badge--${size}`, !custom && `ui-badge--${tone}`, className)} style={style} title={title}>
      {children}
    </span>
  );
}

export default StatusBadge;
