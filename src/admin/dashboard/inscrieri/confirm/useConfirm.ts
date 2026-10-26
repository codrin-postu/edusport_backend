import * as React from 'react';
import { getFetchClient } from '@strapi/admin/strapi-admin';
import { adminToast } from '../../../ui';
import type { ConfirmContext, ConfirmResponse } from '../../../../club/athletes/api-types';
import { CONFIRM_COPY } from '../../../../club/inscrieri-copy';
import { CONFIRM_TOAST_MS, confirmBody, confirmFailure, type WindowState } from '../../../../club/inscrieri-confirm';
import { CLUB_URLS } from '../../../../club/inscrieri-panel';
import { runUndo } from '../undo';
import { dataOf, useStableClient, type StableClient } from '../useClient';

export type ContextState = { data: ConfirmContext | null; loading: boolean; failed: boolean };

/** GET .../confirm-context?athlete= (plan 3-2): reloaded for every chosen athlete; the old answer stays while loading and after a failed reload. */
export function useConfirmContext(registrationId: string, athleteId: string | null): ContextState {
  const { get } = useStableClient();
  const [state, setState] = React.useState<ContextState>({ data: null, loading: true, failed: false });
  React.useEffect(() => {
    let off = false;
    setState((s) => ({ ...s, loading: true, failed: false }));
    get(CLUB_URLS.confirmContext(registrationId, athleteId))
      .then((res) => {
        if (!off) setState({ data: dataOf<ConfirmContext>(res), loading: false, failed: false });
      })
      .catch(() => {
        if (!off) setState((s) => ({ data: s.data, loading: false, failed: true }));
      });
    return () => {
      off = true;
    };
  }, [get, registrationId, athleteId]);
  return state;
}

/**
 * Not tied to the window's life: Strapi's useFetchClient aborts its requests on unmount, and the window
 * closes before the toast's "Anulează" can be clicked (and may close while the confirm request runs).
 */
const post: StableClient['post'] = (url, data, config) => getFetchClient().post(url, data, config);

type Outcome = { succeed: (res: ConfirmResponse) => void; fail: (err: unknown) => void };

/** The toast with "Anulează" (spec 4.6) or the failure (4.7). Plain functions: the undo outlives the window and the panel. */
function outcome(registrationId: string, onClose: () => void, onDone: () => void): Outcome {
  const succeed = (res: ConfirmResponse) => {
    onClose();
    onDone();
    const undo = () => void runUndo(post, registrationId).then(onDone);
    adminToast.success(CONFIRM_COPY.confirmed(res.athleteName), { duration: CONFIRM_TOAST_MS, action: { label: CONFIRM_COPY.undo, onClick: undo } });
  };
  const fail = (err: unknown) => {
    const failure = confirmFailure(err);
    adminToast.error(failure.text);
    if (!failure.close) return;
    onClose();
    onDone();
  };
  return { succeed, fail };
}

/** "Confirmă înscrierea" (spec 4.5 to 4.7): all or nothing on the server; one request however often it is clicked. */
export function useConfirmSubmit(registrationId: string, onClose: () => void, onDone: () => void) {
  const [busy, setBusy] = React.useState(false);
  const sending = React.useRef(false);
  const run = async (state: WindowState, ctx: ConfirmContext) => {
    const body = confirmBody(state, ctx);
    if (!body || sending.current) return;
    sending.current = true;
    setBusy(true);
    const { succeed, fail } = outcome(registrationId, onClose, onDone);
    let saved: ConfirmResponse | null = null;
    try {
      saved = dataOf<ConfirmResponse>(await post(CLUB_URLS.confirm(registrationId), body));
    } catch (err) {
      fail(err);
    } finally {
      sending.current = false;
      setBusy(false);
    }
    if (saved) succeed(saved);
  };
  return { busy, run };
}
