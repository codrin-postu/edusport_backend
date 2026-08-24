import * as React from 'react';
import { Modal, Typography } from '@strapi/design-system';
import { injectStyles } from './injectStyles';

// ---------------------------------------------------------------------------
// PluginModalShell
//
// Reusable modal wrapper for any plugin content. Handles width, close
// behaviour, header/body/footer chrome. Pass any content as `children`
// and action buttons via `footer`.
// ---------------------------------------------------------------------------

export interface PluginModalShellProps {
  isOpen: boolean;
  onClose: () => void;
  title: React.ReactNode;
  /** Optional muted subtitle shown under the title */
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  /** Footer slot — typically action buttons */
  footer?: React.ReactNode;
  /**
   * Max dialog width in px (default 860).
   * Shrinks to `calc(100vw - 2rem)` on narrow viewports automatically.
   */
  maxWidth?: number;
  closeLabel?: string;
}

export default function PluginModalShell({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  maxWidth = 860,
  closeLabel = 'Închide',
}: PluginModalShellProps) {
  return (
    <Modal.Root open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <Modal.Content style={{ width: `min(${maxWidth}px, calc(100vw - 2rem))`, maxWidth: 'none' }}>
        <Modal.Header closeLabel={closeLabel}>
          <div>
            <Modal.Title>{title}</Modal.Title>
            {subtitle && (
              <Typography variant="pi" textColor="neutral500" style={{ display: 'block', marginTop: 2 }}>
                {subtitle}
              </Typography>
            )}
          </div>
        </Modal.Header>

        <Modal.Body>{children}</Modal.Body>

        {footer && <Modal.Footer>{footer}</Modal.Footer>}
      </Modal.Content>
    </Modal.Root>
  );
}

// ---------------------------------------------------------------------------
// Layout helpers exported for use in any modal
// ---------------------------------------------------------------------------

/** Visual section with a horizontal rule and uppercase label */
export function FormSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        marginBottom: 14,
      }}>
        <span style={{
          fontSize: 11,
          fontWeight: 600,
          textTransform: 'uppercase' as const,
          letterSpacing: '0.07em',
          color: 'var(--strapi-neutral500, #8e8ea9)',
          whiteSpace: 'nowrap',
        }}>
          {label}
        </span>
        <div style={{ flex: 1, height: 1, background: 'var(--strapi-neutral150, #eaeaef)' }} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 16 }}>
        {children}
      </div>
    </div>
  );
}

/**
 * Responsive 2-column grid. Each column has equal width and fields fill
 * their cell. Collapses to 1 column on viewports narrower than `breakAt`.
 */
export function FormRow({
  children,
  columns = 2,
}: {
  children: React.ReactNode;
  columns?: number;
}) {
  injectStyles('plugin-form-row-styles', `
    .plugin-form-row { display: grid; gap: 16px; }
    .plugin-form-row-2 { grid-template-columns: repeat(2, 1fr); }
    .plugin-form-row-3 { grid-template-columns: repeat(3, 1fr); }
    @media (max-width: 630px) {
      .plugin-form-row-2, .plugin-form-row-3 { grid-template-columns: 1fr; }
    }
  `);
  return (
    <div className={`plugin-form-row plugin-form-row-${columns}`}>
      {children}
    </div>
  );
}
