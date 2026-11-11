import * as React from 'react';
import { ConfirmDialog } from '../../ConfirmDialog';
import { Button, Loading, adminToast } from '../../ui';
import type { AccessAnswer, AccessBlock as AccessBlockData } from '../../../club/portal/access/api-types';
import { ACCESS_COPY } from '../../../club/portal/access/copy';
import { ACCESS_LABELS, accessActions, sinceText, statusText, type AccessAction } from '../../../club/sportivi/access-view';
import { requestErrorText } from '../../../club/registration-panel';
import type { SportiviApi } from './api';

const FAILED = 'Acțiunea nu a reușit.';
const TITLE = 'Acces portal';

/** Loads the access block of one athlete; `reloadOn` changes (a saved edit) read it again, since an e-mail edit moves the access. */
export function useAccessBlock(api: SportiviApi, athleteId: string, reloadOn: unknown) {
  const [block, setBlock] = React.useState<AccessBlockData | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  React.useEffect(() => {
    let live = true;
    api.accessRead(athleteId).then((b) => live && setBlock(b)).catch((e) => live && setError(requestErrorText(e, FAILED)));
    return () => {
      live = false;
    };
  }, [api, athleteId, reloadOn]);
  return { block, setBlock, error };
}

function useAccessRun(api: SportiviApi, athleteId: string, set: (b: AccessBlockData) => void) {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const run = async (action: AccessAction): Promise<boolean> => {
    setBusy(true);
    setError(null);
    try {
      const call: Record<AccessAction, () => Promise<AccessAnswer>> = {
        invite: () => api.accessInvite(athleteId),
        resend: () => api.accessResend(athleteId),
        remove: () => api.accessRemove(athleteId),
      };
      const answer = await call[action]();
      set(answer.access);
      adminToast.success(answer.toast);
      return true;
    } catch (e) {
      setError(requestErrorText(e, FAILED));
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, run };
}

/** "Acces portal" (spec 4.6) at the bottom of the athlete record tab "Date". */
export function AccessBlock({ api, athleteId, athleteName, state }: {
  api: SportiviApi; athleteId: string; athleteName: string; state: ReturnType<typeof useAccessBlock>;
}) {
  const { block, setBlock, error: loadError } = state;
  const { busy, error, run } = useAccessRun(api, athleteId, setBlock);
  const [confirm, setConfirm] = React.useState(false);
  if (!block) return loadError ? <div className="ui-error" role="alert">{loadError}</div> : <Loading />;
  const actions = accessActions(block);
  const since = sinceText(block.since);
  const click = (a: AccessAction) => (a === 'remove' ? setConfirm(true) : void run(a));
  return (
    <section aria-label={TITLE} style={{ marginTop: 16, borderTop: '1px solid var(--theme-border)', paddingTop: 12 }}>
      <h3 style={{ fontSize: 'var(--ui-fs-body-sm)', fontWeight: 700, margin: '0 0 8px' }}>{TITLE}</h3>
      {block.email && <p style={{ margin: '0 0 4px' }}>{block.email}</p>}
      <p style={{ margin: '0 0 10px', color: 'var(--theme-text-muted)' }}>{[statusText(block), since].filter(Boolean).join(' ')}</p>
      {block.state === 'none' && block.hint && <p className="ui-hint">{block.hint}</p>}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {actions.map((a) => (
          <Button key={a} variant={a === 'remove' ? 'danger' : 'secondary'} disabled={busy} onClick={() => click(a)}>{ACCESS_LABELS[a]}</Button>
        ))}
      </div>
      {error && !confirm && <div className="ui-error" role="alert" style={{ marginTop: 10 }}>{error}</div>}
      <ConfirmDialog
        open={confirm}
        title={ACCESS_LABELS.remove}
        message={ACCESS_COPY.removeConfirm(block.email ?? '', athleteName)}
        confirmLabel={ACCESS_LABELS.remove}
        busyLabel={ACCESS_LABELS.remove}
        busy={busy}
        error={error}
        onCancel={() => setConfirm(false)}
        onConfirm={() => void run('remove').then((done) => done && setConfirm(false))}
      />
    </section>
  );
}
