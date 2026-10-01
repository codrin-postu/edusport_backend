import * as React from 'react';
import { cx } from './cx';
import type { BadgeTone } from './StatusBadge';

export interface StatTileProps {
  /** Short uppercase caption above the figure, e.g. "Sportivi". */
  label: React.ReactNode;
  /** The figure itself (a number is shown with tabular digits). */
  value: React.ReactNode;
  /** Muted line under the figure, e.g. "în 2026". */
  caption?: React.ReactNode;
  /** Colour of the left edge. Default 'primary'. */
  tone?: BadgeTone;
  className?: string;
}

/**
 * KPI tile: label, big figure, optional caption, with a 3px coloured left
 * edge. Square corners, raised surface. Lay several out with `.ui-stats`
 * (a wrapping grid) or any grid of the page's own.
 */
export function StatTile({ label, value, caption, tone = 'primary', className }: StatTileProps) {
  return (
    <div className={cx('ui-stat', `ui-stat--${tone}`, className)}>
      <div className="ui-stat-label">{label}</div>
      <div className="ui-stat-value">{value}</div>
      {caption && <div className="ui-stat-caption">{caption}</div>}
    </div>
  );
}

export default StatTile;
