import * as React from 'react';
import { adminToast } from '../../ui';
import { PRESENCE_ERRORS } from '../../../club/presence/copy/core';
import { MONEY_UI_COPY } from '../../../club/presence/copy/money-ui';
import { requestErrorText } from '../../../club/registration-panel';
import type { PrezentaApi } from './api';

/** The toast's "Anulează" (spec 7.3): 8 seconds, no X; plain async, so it outlives the screen that started it. */
export const UNDO_MS = 8000;
const UNDONE = MONEY_UI_COPY.undo.done;
const listeners = new Set<() => void>();

/** Every open Prezență screen reloads after a write. */
export function prezentaChanged(): void {
  listeners.forEach((fn) => fn());
}

export function usePrezentaRefresh(reload: () => void): void {
  const ref = React.useRef(reload);
  ref.current = reload;
  React.useEffect(() => {
    const fn = () => ref.current();
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  }, []);
}

export const failToast = (err: unknown): void => {
  adminToast.error(requestErrorText(err, PRESENCE_ERRORS.failed));
};

async function runUndo(api: PrezentaApi, actionId: string): Promise<void> {
  try {
    await api.undo(actionId);
    adminToast.success(UNDONE);
  } catch (err) {
    failToast(err);
  } finally {
    prezentaChanged();
  }
}

/** The action's toast; with an action id it carries "Anulează" for 8 seconds. Every open screen reloads at once. */
export function undoToast(api: PrezentaApi, text: string, actionId: string | null): void {
  prezentaChanged();
  if (!actionId) {
    adminToast.success(text);
    return;
  }
  adminToast.success(text, { duration: UNDO_MS, action: { label: MONEY_UI_COPY.undo.action, onClick: () => void runUndo(api, actionId) } });
}
