import * as React from 'react';
import { cx } from './cx';

export interface SectionProps {
  title?: React.ReactNode;
  /** Right side of the title bar (a count, a small button). */
  aside?: React.ReactNode;
  /** Footer strip (e.g. an Adaugă button). */
  footer?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  id?: string;
}

/** Titled, bordered block inside a page body (the old .sec / .sh / .sb). */
export function Section({ title, aside, footer, children, className, id }: SectionProps) {
  const headingId = React.useId();
  return (
    <section className={cx('ui-sec', className)} id={id} aria-labelledby={title ? headingId : undefined}>
      {(title || aside) && (
        <div className="ui-sec-h">
          {title && (
            <h2 className="ui-sec-title" id={headingId}>
              {title}
            </h2>
          )}
          {aside}
        </div>
      )}
      <div className="ui-sec-b">{children}</div>
      {footer && <div className="ui-sec-f">{footer}</div>}
    </section>
  );
}

export default Section;
