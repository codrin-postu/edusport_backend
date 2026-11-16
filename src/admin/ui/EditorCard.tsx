import * as React from 'react';
import { cx } from './cx';
import { ensureAdminUi } from './styles';

export interface EditorCardProps {
  title?: React.ReactNode;
  description?: React.ReactNode;
  /** Right side of the header, e.g. an Adaugă button, a count or a HelpTip. */
  headerAction?: React.ReactNode;
  /** Strip under the body (e.g. an Adaugă button). */
  footer?: React.ReactNode;
  children: React.ReactNode;
  /** Body without padding (lists, tables that bring their own). */
  flush?: boolean;
  /** 'plain': header on the card surface with a small uppercase title (the look of a section inside a page body). */
  variant?: 'plain';
  className?: string;
  id?: string;
}

/**
 * The one card of the admin: header (title, optional description and action)
 * over a raised body, optional footer. Carries `.ui-root` itself, so
 * it renders the same inside a content-manager custom field (no AdminPage
 * around it) and on dashboard pages. Port of the plugin's
 * components/EditorCard, on tokens.
 */
export function EditorCard({ title, description, headerAction, footer, children, flush = false, variant, className, id }: EditorCardProps) {
  React.useInsertionEffect(() => ensureAdminUi(), []);
  const headingId = React.useId().replace(/:/g, '');
  const hasHeader = title || headerAction;
  return (
    <section
      id={id}
      className={cx('ui-root', 'ui-ecard', variant === 'plain' && 'ui-ecard--plain', className)}
      aria-labelledby={title ? `ui-ech${headingId}` : undefined}
    >
      {hasHeader && (
        <div className="ui-ecard-h">
          <div className="ui-ecard-titles">
            {title && (
              <h3 className="ui-ecard-title" id={`ui-ech${headingId}`}>
                {title}
              </h3>
            )}
            {description && <p className="ui-ecard-desc">{description}</p>}
          </div>
          {headerAction && <div className="ui-ecard-action">{headerAction}</div>}
        </div>
      )}
      <div className={cx('ui-ecard-b', flush && 'ui-ecard-b--flush')}>{children}</div>
      {footer && <div className="ui-ecard-f">{footer}</div>}
    </section>
  );
}

export default EditorCard;
