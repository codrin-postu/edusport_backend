import * as React from 'react';
import { ConfirmDialog } from '../../ConfirmDialog';
import { Button, EditorCard, Loading, StatusBadge, adminToast } from '../../ui';
import type { AccessAnswer, AccessBlock as AccessBlockData } from '../../../club/portal/access/api-types';
import { ACCESS_COPY } from '../../../club/portal/access/copy';
import { ACCESS_LABELS, accessActions, type AccessAction } from '../../../club/sportivi/access-view';
import { accessBadge, accessBadgeState } from '../../../club/sportivi/access-badge';
import { isExampleInvitee } from '../../../club/onboarding/fixtures';
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
  const badge = accessBadge(accessBadgeState(block.state));
  const click = (a: AccessAction) => (a === 'remove' ? setConfirm(true) : void run(a));
  return (
    <EditorCard title={TITLE}>
      <div className="spv-access" data-tour={isExampleInvitee(athleteId) ? 'pa-acces' : undefined}>
        <div className="spv-access-who">
          {block.email && <span className="spv-access-mail">{block.email}</span>}
          <StatusBadge tone={badge.tone}>{badge.text}</StatusBadge>
        </div>
        <div className="spv-access-acts">
          {actions.map((a) => (
            <Button key={a} variant={a === 'remove' ? 'danger' : 'secondary'} disabled={busy} onClick={() => click(a)} data-tour={a === 'invite' && isExampleInvitee(athleteId) ? 'pa-invita' : undefined}>{ACCESS_LABELS[a]}</Button>
          ))}
        </div>
      </div>
      {error && !confirm && <div className="ui-error" role="alert">{error}</div>}
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
    </EditorCard>
  );
}
