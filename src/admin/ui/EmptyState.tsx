import * as React from 'react';

export interface EmptyStateProps {
  children: React.ReactNode;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}

/** "Nothing here" block for lists, tables and panes. */
export function EmptyState({ children, icon, action }: EmptyStateProps) {
  return (
    <div className="adm-empty">
      {icon && <div className="adm-empty-icon" aria-hidden="true">{icon}</div>}
      <div>{children}</div>
      {action}
    </div>
  );
}

export default EmptyState;
