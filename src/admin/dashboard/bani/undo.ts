import * as React from 'react';
import { adminToast } from '../../ui';
import { PRESENCE_ERRORS } from '../../../club/presence/copy/core';
import { requestErrorText } from '../../../club/registration-panel';
import type { MoneyApi } from './api';

/** The toast's "Anulează" (spec 7.3): 8 seconds, no X; plain async, so it outlives the screen that started it. */
export const UNDO_MS = 8000;
const UNDONE = 'Anulat.';
const listeners = new Set<() => void>();

/** Every open money screen reloads after a write. */
export function moneyChanged(): void {
  listeners.forEach((fn) => fn());
}

export function useMoneyChanged(reload: () => void): void {
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

async function runUndo(api: MoneyApi, actionId: string): Promise<void> {
  try {
    await api.undo(actionId);
    adminToast.success(UNDONE);
  } catch (err) {
    adminToast.error(requestErrorText(err, PRESENCE_ERRORS.failed));
  } finally {
    moneyChanged();
  }
}

/** The action's toast; with an action id it carries "Anulează" for 8 seconds, and a refused undo shows the server's text. Every open screen reloads at once. */
export function moneyUndoToast(text: string, actionId: string | null, api: MoneyApi): void {
  moneyChanged();
  if (!actionId) {
    adminToast.success(text);
    return;
  }
  adminToast.success(text, { duration: UNDO_MS, action: { label: 'Anulează', onClick: () => void runUndo(api, actionId) } });
}
