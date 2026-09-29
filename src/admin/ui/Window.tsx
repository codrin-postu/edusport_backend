import * as React from 'react';
import { cx } from './cx';

export interface WindowProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

/** The bordered card that holds a page's header, toolbar and content. */
export function Window({ children, className, ...rest }: WindowProps) {
  return (
    <div className={cx('adm-win', className)} {...rest}>
      {children}
    </div>
  );
}

export default Window;
