import * as React from 'react';
import { ConfirmDialog } from '../../ConfirmDialog';
import { Button, Field, Input, Loading, Modal, adminToast } from '../../ui';
import type { AccountAnswer, AccountBlock as AccountBlockData } from '../../../club/portal/accounts/api-types';
import { ACCESS_ACTIONS, ACCESS_COPY } from '../../../club/portal/access/copy';
import { ACCOUNT_BLOCK, accountBlockActions, accountDisableConfirmText } from '../../../club/portal/copy-admin';
import { accountDate, accountErrorText, usePortalAccountApi } from './api';

const FAILED = 'Acțiunea nu a reușit.';

/**
 * "Cont portal" (spec 10.1) of one team member: invite, resend, disable, enable and e-mail change.
 * It sits in the "Membri echipă" editor and in the coach window of the group page (ruling 22: the team member
 * editor is the custom page, not the Content Manager).
 */
export function AccountBlock({ teamMemberId, name }: { teamMemberId: string; name: string }) {
  const api = usePortalAccountApi();
  const [block, setBlock] = React.useState<AccountBlockData | null>(null);
  const [email, setEmail] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [confirm, setConfirm] = React.useState(false);
  const [confirmAll, setConfirmAll] = React.useState(false);
  const [changing, setChanging] = React.useState(false);
  const [newEmail, setNewEmail] = React.useState('');

  React.useEffect(() => {
    let live = true;
    setBlock(null);
    api.read(teamMemberId).then((b) => live && setBlock(b)).catch((e) => live && setError(accountErrorText(e, FAILED)));
    return () => {
      live = false;
    };
  }, [api, teamMemberId]);

  const run = async (work: () => Promise<AccountAnswer>): Promise<boolean> => {
    setBusy(true);
    setError(null);
    try {
      const answer = await work();
      setBlock(answer.account);
      adminToast.success(answer.toast);
      return true;
    } catch (e) {
      setError(accountErrorText(e, FAILED));
      return false;
    } finally {
      setBusy(false);
    }
  };

  if (!block) return error ? <div className="ui-error" role="alert">{error}</div> : <Loading />;
  const id = block.accountId ?? '';
  const since = accountDate(block.since);
  const actions = accountBlockActions(block);

  return (
    <section aria-label={ACCOUNT_BLOCK.title} style={{ marginTop: 16, borderTop: '1px solid var(--theme-border)', paddingTop: 12 }}>
      <h3 style={{ fontSize: 'var(--ui-fs-body-sm)', fontWeight: 700, margin: '0 0 8px' }}>{ACCOUNT_BLOCK.title}</h3>
      {block.state === 'none' && (
        <>
          <Field label={ACCOUNT_BLOCK.emailLabel}>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Button disabled={busy || email.trim() === ''} loading={busy} onClick={() => void run(() => api.invite(teamMemberId, email))}>
            {ACCOUNT_BLOCK.invite}
          </Button>
        </>
      )}
      {block.state !== 'none' && (
        <>
          <p style={{ margin: '0 0 8px' }}>{block.email}</p>
          <p style={{ margin: '0 0 10px', color: 'var(--theme-text-muted)' }}>
            {block.state === 'invited' && ACCOUNT_BLOCK.invited(since)}
            {block.state === 'active' && ACCOUNT_BLOCK.active(since)}
            {block.state === 'active' && block.coachDisabled && ` ${ACCOUNT_BLOCK.coachSideOff}`}
            {block.state === 'disabled' && ACCOUNT_BLOCK.disabled}
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {block.state === 'invited' && <Button variant="secondary" disabled={busy} onClick={() => void run(() => api.resend(id))}>{ACCOUNT_BLOCK.resend}</Button>}
            {actions.disable && <Button variant="danger" disabled={busy} onClick={() => setConfirm(true)}>{ACCOUNT_BLOCK.disable}</Button>}
            {actions.disableAll && <Button variant="danger" disabled={busy} onClick={() => setConfirmAll(true)}>{ACCESS_ACTIONS.disableAll}</Button>}
            {actions.enable && <Button variant="secondary" disabled={busy} onClick={() => void run(() => api.enable(id))}>{ACCOUNT_BLOCK.enable}</Button>}
            <Button variant="secondary" disabled={busy} onClick={() => { setNewEmail(''); setChanging(true); }}>{ACCOUNT_BLOCK.changeEmail}</Button>
          </div>
        </>
      )}
      {error && <div className="ui-error" role="alert" style={{ marginTop: 10 }}>{error}</div>}

      <ConfirmDialog
        open={confirm}
        title={ACCOUNT_BLOCK.disable}
        message={accountDisableConfirmText(name)}
        confirmLabel={ACCOUNT_BLOCK.disable}
        busyLabel={ACCOUNT_BLOCK.disable}
        busy={busy}
        error={error}
        onCancel={() => setConfirm(false)}
        onConfirm={() => void run(() => api.disable(id)).then((done) => done && setConfirm(false))}
      />

      <ConfirmDialog
        open={confirmAll}
        title={ACCESS_ACTIONS.disableAll}
        message={ACCESS_COPY.disableAllConfirm(name)}
        confirmLabel={ACCESS_ACTIONS.disableAll}
        busyLabel={ACCESS_ACTIONS.disableAll}
        busy={busy}
        error={error}
        onCancel={() => setConfirmAll(false)}
        onConfirm={() => void run(() => api.disableAll(id)).then((done) => done && setConfirmAll(false))}
      />

      <Modal
        open={changing}
        onClose={() => setChanging(false)}
        dismissable={!busy}
        title={ACCOUNT_BLOCK.newEmail}
        footer={
          <Button disabled={busy || newEmail.trim() === ''} loading={busy} onClick={() => void run(() => api.changeEmail(id, newEmail)).then((done) => done && setChanging(false))}>
            {ACCOUNT_BLOCK.saveEmail}
          </Button>
        }
      >
        <Field label={ACCOUNT_BLOCK.newEmail}>
          <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
        </Field>
        {error && <div className="ui-error" role="alert">{error}</div>}
      </Modal>
    </section>
  );
}
