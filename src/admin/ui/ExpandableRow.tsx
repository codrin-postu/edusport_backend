import * as React from 'react';
import { cx } from './cx';
import { IconChevronDown } from './icons';
import type { DragItemProps } from './useDragReorder';

export interface ExpandableRowProps {
  /** Collapsed line: what the row is (a name, a title, a short summary). */
  summary: React.ReactNode;
  expanded: boolean;
  onToggle: () => void;
  /** Left of the summary, e.g. a drag handle. */
  lead?: React.ReactNode;
  /** Right of the summary, e.g. a delete button. Clicks here do not toggle. */
  actions?: React.ReactNode;
  /** The editor, shown while expanded. */
  children: React.ReactNode;
  /** Accessible name of the toggle when `summary` is not plain text. */
  toggleLabel?: string;
  className?: string;
  /** Props for the row element (drag handlers from useDragReorder). */
  rowProps?: Partial<DragItemProps>;
  as?: 'div' | 'li';
}

/**
 * Bordered row with a header that opens and closes its body. The header is
 * one button (aria-expanded, aria-controls) with a chevron; the body stays
 * unmounted while closed.
 */
export function ExpandableRow({
  summary,
  expanded,
  onToggle,
  lead,
  actions,
  children,
  toggleLabel,
  className,
  rowProps,
  as = 'div',
}: ExpandableRowProps) {
  const bodyId = React.useId().replace(/:/g, '');
  const Tag = as;
  return (
    <Tag {...rowProps} className={cx('ui-row', expanded && 'ui-row--open', className)}>
      <div className="ui-row-h">
        {lead}
        <button
          type="button"
          className="ui-row-toggle"
          aria-expanded={expanded}
          aria-controls={expanded ? `ui-rb${bodyId}` : undefined}
          aria-label={toggleLabel}
          onClick={onToggle}
        >
          <span className="ui-row-summary">{summary}</span>
          <span className="ui-row-chev">
            <IconChevronDown />
          </span>
        </button>
        {actions && <div className="ui-row-actions">{actions}</div>}
      </div>
      {expanded && (
        <div className="ui-row-b" id={`ui-rb${bodyId}`}>
          {children}
        </div>
      )}
    </Tag>
  );
}

export default ExpandableRow;
