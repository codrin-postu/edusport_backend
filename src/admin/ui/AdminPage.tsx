import * as React from 'react';
import { cx } from './cx';
import { ensureAdminUi } from './styles';

export interface AdminPageProps {
  children: React.ReactNode;
  className?: string;
  /** Stack direct children with the standard 16px gap. Default true. */
  stack?: boolean;
}

/**
 * Root of every custom admin page: page background, padding, the `adm-root`
 * scope for the component classes and the theme tokens. Replaces the `.eduf`
 * root. Also opts every button inside out of the global SaveBar tagger.
 */
export function AdminPage({ children, className, stack = true }: AdminPageProps) {
  // Safety net: the bootstrap already injects the sheet; this covers pages
  // rendered before it (or in isolation).
  React.useInsertionEffect(() => ensureAdminUi(), []);
  return <div className={cx('adm-root', 'adm-page', stack && 'adm-stack', className)}>{children}</div>;
}

export default AdminPage;
