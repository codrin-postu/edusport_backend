import * as React from 'react';
import { adminToast } from '../../ui';
import { GROUP_ERRORS, GROUP_TOASTS } from '../../../club/groups/copy';
import { requestErrorText } from '../../../club/registration-panel';
import type { GrupeApi } from './api';

/** The toast's "Anulează" (spec 8.1, W15): 8 seconds, no X; plain async, so it outlives the screen that started it. */
export const UNDO_MS = 8000;
const listeners = new Set<() => void>();

/** Every open Grupe screen reloads (list, group page, Program tab). */
export function grupeChanged(): void {
  listeners.forEach((fn) => fn());
}

export function useGrupeRefresh(reload: () => void): void {
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
  adminToast.error(requestErrorText(err, GROUP_ERRORS.failed));
};

/** A write that changed nothing because the page was out of date: the stale text as an error, and every screen reloads. */
export function staleToast(): void {
  adminToast.error(GROUP_ERRORS.stale);
  grupeChanged();
}

async function runUndo(api: GrupeApi, actionId: string): Promise<void> {
  try {
    await api.undo(actionId);
    adminToast.success(GROUP_TOASTS.undone);
  } catch (err) {
    failToast(err);
  } finally {
    grupeChanged();
  }
}

/** The action's toast; with an action id it carries "Anulează" for 8 seconds. Every open screen reloads at once. */
export function undoToast(text: string, actionId: string | null, api: GrupeApi): void {
  grupeChanged();
  if (!actionId) {
    adminToast.success(text);
    return;
  }
  adminToast.success(text, { duration: UNDO_MS, action: { label: GROUP_TOASTS.undo, onClick: () => void runUndo(api, actionId) } });
}
