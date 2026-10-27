import * as React from 'react';
import { cx } from './cx';
import { Button } from './Button';
import { IconClose } from './icons';

export type NoticeTone = 'success' | 'warning' | 'danger' | 'info';

export interface NoticeProps {
  tone?: NoticeTone;
  title?: React.ReactNode;
  children?: React.ReactNode;
  /** A Button, placed on the right. */
  action?: React.ReactNode;
  /** When set, a close button ends the row and calls this. */
  onDismiss?: () => void;
  className?: string;
}

/** Inline message block. danger and warning are announced as alerts, success and info politely. */
export function Notice({ tone = 'info', title, children, action, onDismiss, className }: NoticeProps) {
  const urgent = tone === 'danger' || tone === 'warning';
  return (
    <div className={cx('ui-notice', `ui-notice--${tone}`, !title && 'ui-notice--plain', className)} role={urgent ? 'alert' : 'status'}>
      <span className="ui-notice-mark" aria-hidden="true" />
      <div className="ui-notice-text">
        {title && <b className="ui-notice-title">{title}</b>}
        {children && <span className="ui-notice-body">{children}</span>}
      </div>
      {action && <div className="ui-notice-action">{action}</div>}
      {onDismiss && (
        <div className="ui-notice-close">
          <Button variant="ghost" size="sm" iconOnly icon={<IconClose />} aria-label="Închide" onClick={onDismiss} />
        </div>
      )}
    </div>
  );
}

export default Notice;
