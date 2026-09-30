import * as React from 'react';
import { cx } from './cx';
import { ensureAdminUi } from './styles';

export interface EditorCardProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Right side of the header, e.g. an Adaugă button or a HelpTip. */
  headerAction?: React.ReactNode;
  children: React.ReactNode;
  /** Body without padding (lists, tables that bring their own). */
  flush?: boolean;
  className?: string;
  id?: string;
}

/**
 * Card for a field editor: header (accent bar on the left, title, optional
 * description and action) over a raised body. Carries `.ui-root` itself, so
 * it renders the same inside a content-manager custom field (no AdminPage
 * around it) and on dashboard pages. Port of the plugin's
 * components/EditorCard, on tokens.
 */
export function EditorCard({ title, description, headerAction, children, flush = false, className, id }: EditorCardProps) {
  React.useInsertionEffect(() => ensureAdminUi(), []);
  const headingId = React.useId().replace(/:/g, '');
  return (
    <section id={id} className={cx('ui-root', 'ui-ecard', className)} aria-labelledby={`ui-ech${headingId}`}>
      <div className="ui-ecard-h">
        <div className="ui-ecard-titles">
          <h3 className="ui-ecard-title" id={`ui-ech${headingId}`}>
            {title}
          </h3>
          {description && <p className="ui-ecard-desc">{description}</p>}
        </div>
        {headerAction && <div className="ui-ecard-action">{headerAction}</div>}
      </div>
      <div className={cx('ui-ecard-b', flush && 'ui-ecard-b--flush')}>{children}</div>
    </section>
  );
}

export default EditorCard;
