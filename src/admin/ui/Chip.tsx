import * as React from 'react';
import { cx } from './cx';

export interface ChipProps {
  children: React.ReactNode;
  /** When set, shows the x button. */
  onRemove?: () => void;
  /** Accessible name of the x button. Default: "Elimină <text>". */
  removeLabel?: string;
  title?: string;
  className?: string;
}

/** Removable tag, for active filters and relation pickers. */
export function Chip({ children, onRemove, removeLabel, title, className }: ChipProps) {
  const text = typeof children === 'string' ? children : '';
  return (
    <span className={cx('ui-chip', !onRemove && 'ui-chip--static', className)} title={title ?? (text || undefined)}>
      <span className="ui-chip-label">{children}</span>
      {onRemove && (
        <button type="button" className="ui-chip-x" onClick={onRemove} aria-label={removeLabel ?? (text ? `Elimină ${text}` : 'Elimină')}>
          <span aria-hidden="true">×</span>
        </button>
      )}
    </span>
  );
}

/** Wrapping row of chips. */
export function ChipList({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cx('ui-chips', className)}>{children}</div>;
}

export default Chip;
