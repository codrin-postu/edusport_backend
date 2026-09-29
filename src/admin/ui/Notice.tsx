import * as React from 'react';
import { cx } from './cx';

export type NoticeTone = 'ok' | 'warn' | 'danger' | 'info';

export interface NoticeProps {
  tone?: NoticeTone;
  title?: React.ReactNode;
  children?: React.ReactNode;
  /** A Button, placed on the right. */
  action?: React.ReactNode;
  className?: string;
}

/** Inline message block. danger and warn are announced as alerts, ok and info politely. */
export function Notice({ tone = 'info', title, children, action, className }: NoticeProps) {
  const urgent = tone === 'danger' || tone === 'warn';
  return (
    <div className={cx('adm-notice', `adm-notice--${tone}`, className)} role={urgent ? 'alert' : 'status'}>
      <span className="adm-notice-mark" aria-hidden="true" />
      <div className="adm-notice-text">
        {title && <b className="adm-notice-title">{title}</b>}
        {children && <span className="adm-notice-body">{children}</span>}
      </div>
      {action && <div className="adm-notice-action">{action}</div>}
    </div>
  );
}

export default Notice;
