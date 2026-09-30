import * as React from 'react';
import { cx } from './cx';

export interface TwoColumnProps {
  rail: React.ReactNode;
  children: React.ReactNode;
  /** Rail width in px. Default 280. Stacks under 900px. */
  railWidth?: number;
  railLabel?: string;
  className?: string;
  railClassName?: string;
}

/** Rail + body layout used by edit pages. */
export function TwoColumn({ rail, children, railWidth, railLabel, className, railClassName }: TwoColumnProps) {
  const style = railWidth ? ({ '--ui-rail-w': `${railWidth}px` } as React.CSSProperties) : undefined;
  return (
    <div className={cx('ui-two', className)} style={style}>
      <aside className={cx('ui-rail', railClassName)} aria-label={railLabel}>
        {rail}
      </aside>
      <div className="ui-body">{children}</div>
    </div>
  );
}

export default TwoColumn;
