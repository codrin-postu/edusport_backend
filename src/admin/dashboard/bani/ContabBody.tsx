import * as React from 'react';
import { createPortal } from 'react-dom';

/** What the Contabilitate page hands to a tab body: the tab's own filter params (in the URL), a way to replace them, and the header slot the body puts its buttons into. */
export type ContabBodyProps = {
  month: string;
  params: URLSearchParams;
  setParams: (next: URLSearchParams) => void;
  actionsHost: HTMLElement | null;
};

/** The body's buttons, shown in the tab window's header (nothing until the slot exists). */
export function ActionsSlot({ host, children }: { host: HTMLElement | null; children: React.ReactNode }) {
  return host ? createPortal(children, host) : null;
}
