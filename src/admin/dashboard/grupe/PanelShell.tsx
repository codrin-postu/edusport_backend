import * as React from 'react';
import { BottomSheet, Drawer, Modal, useIsPhone } from '../../ui';

type ShellProps = { title: React.ReactNode; footer?: React.ReactNode; onClose: () => void; children: React.ReactNode };

/** A window (Modal) on desktop, a full-height bottom sheet on phones (decided 6). */
export function WindowShell({ title, footer, onClose, children, size = 'md' }: ShellProps & { size?: 'sm' | 'md' | 'lg' }) {
  const phone = useIsPhone();
  if (phone) return <BottomSheet open fullHeight title={title} onClose={onClose} footer={footer}>{children}</BottomSheet>;
  return <Modal open size={size} title={title} onClose={onClose} footer={footer}>{children}</Modal>;
}

/** A side panel (Drawer) on desktop, a full-height bottom sheet on phones (6.3). */
export function PanelShell({ title, footer, onClose, children }: ShellProps) {
  const phone = useIsPhone();
  if (phone) return <BottomSheet open fullHeight title={title} onClose={onClose} footer={footer}>{children}</BottomSheet>;
  return <Drawer open title={title} onClose={onClose} footer={footer}>{children}</Drawer>;
}
