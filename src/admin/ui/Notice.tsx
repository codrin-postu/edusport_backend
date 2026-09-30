import * as React from 'react';
import { cx } from './cx';

export type NoticeTone = 'success' | 'warning' | 'danger' | 'info';

export interface NoticeProps {
  tone?: NoticeTone;
  title?: React.ReactNode;
  children?: React.ReactNode;
  /** A Button, placed on the right. */
  action?: React.ReactNode;
  className?: string;
}

/** Inline message block. danger and warning are announced as alerts, success and info politely. */
export function Notice({ tone = 'info', title, children, action, className }: NoticeProps) {
  const urgent = tone === 'danger' || tone === 'warning';
  return (
    <div className={cx('ui-notice', `ui-notice--${tone}`, className)} role={urgent ? 'alert' : 'status'}>
      <span className="ui-notice-mark" aria-hidden="true" />
      <div className="ui-notice-text">
        {title && <b className="ui-notice-title">{title}</b>}
        {children && <span className="ui-notice-body">{children}</span>}
      </div>
      {action && <div className="ui-notice-action">{action}</div>}
    </div>
  );
}

export default Notice;
