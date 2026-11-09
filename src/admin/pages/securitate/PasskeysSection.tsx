import * as React from 'react';
import type { PasskeyRow } from '../../../club/security/api-types';
import { SECURITY_COPY, SECURITY_ERRORS } from '../../../club/security/copy';
import { longDate } from '../../../club/presence/dates';
import { browserWebauthn, type Webauthn } from '../../lib/webauthn';
import { Field } from '../../ui/Field';
import { Input } from '../../ui/Input';
import { Notice } from '../../ui/Notice';
import { Section } from '../../ui/Section';
import { adminToast } from '../../ui/Toast';
import { errorText } from './errors';
import type { SecurityApi } from './client';
import { Row, mutedStyle, stackStyle } from './layout';
import { addKey, confirmReauth, GOOGLE_REAUTH_URL, keySub, reauthAsk, startEmailReauth, type ReauthAsk } from './passkeys';
import { PceButton } from './PceButton';

const C = SECURITY_COPY.passkeys;
const NAME_MAX = 60;

/** One key per row: name and dates, "Redenumește" and "Șterge"; an old key says it no longer works and only offers "Șterge". */
export function PasskeysList(p: { rows: PasskeyRow[]; busy: boolean; onRename: (r: PasskeyRow) => void; onDelete: (r: PasskeyRow) => void }) {
  return (
    <>
      {p.rows.map((r, i) => (
        <Row key={r.id} first={i === 0}>
          <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span>{r.name}</span>
            <span style={mutedStyle}>{r.old ? C.old : keySub(r.createdAt, r.lastUsedAt, longDate)}</span>
          </span>
          <span style={{ display: 'flex', gap: 8 }}>
            {!r.old && <PceButton variant="secondary" size="sm" disabled={p.busy} onClick={() => p.onRename(r)}>{C.rename}</PceButton>}
            <PceButton variant="secondary" size="sm" disabled={p.busy} onClick={() => p.onDelete(r)}>{C.delete}</PceButton>
          </span>
        </Row>
      ))}
    </>
  );
}

/** The rename row: field "Nume" (60 at most) with the save and cancel buttons. */
export function RenameForm(p: { name: string; busy: boolean; onName: (v: string) => void; onSave: () => void; onCancel: () => void }) {
  return (
    <div style={stackStyle}>
      <Field label={C.nameField}>
        <Input value={p.name} maxLength={NAME_MAX} onChange={(e) => p.onName(e.target.value)} />
      </Field>
      <span style={{ display: 'flex', gap: 8 }}>
        <PceButton size="sm" loading={p.busy} disabled={p.name.trim() === ''} onClick={p.onSave}>{C.saveName}</PceButton>
        <PceButton variant="secondary" size="sm" disabled={p.busy} onClick={p.onCancel}>{SECURITY_COPY.twoFactor.cancel}</PceButton>
      </span>
    </div>
  );
}

/** The re-confirmation step before a key can be added: the 2FA code or the password, and for a linked Google account a fresh Google sign-in. */
export function ReauthForm(p: {
  ask: ReauthAsk; sentTo: string | null; value: string; busy: boolean; google: boolean;
  onValue: (v: string) => void; onConfirm: () => void; onCancel: () => void;
}) {
  const label = p.ask.kind === 'password' ? SECURITY_COPY.password.current : p.ask.method === 'totp' ? SECURITY_COPY.twoFactor.appCode : SECURITY_COPY.twoFactor.emailCode;
  return (
    <div style={stackStyle}>
      <Notice tone="info">{SECURITY_ERRORS.reauthRequired}</Notice>
      {p.sentTo && <span style={mutedStyle}>{SECURITY_COPY.twoFactor.emailSent(p.sentTo)}</span>}
      <Field label={label}>
        <Input type={p.ask.kind === 'password' ? 'password' : 'text'} value={p.value} autoComplete={p.ask.kind === 'password' ? 'current-password' : 'one-time-code'} onChange={(e) => p.onValue(e.target.value)} />
      </Field>
      <span style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <PceButton size="sm" loading={p.busy} disabled={p.value.trim() === ''} onClick={p.onConfirm}>{C.reauthConfirm}</PceButton>
        {p.google && <a className="ui-btn" href={GOOGLE_REAUTH_URL}>{SECURITY_COPY.login.google}</a>}
        <PceButton variant="secondary" size="sm" disabled={p.busy} onClick={p.onCancel}>{SECURITY_COPY.twoFactor.cancel}</PceButton>
      </span>
    </div>
  );
}

type Panel = { kind: 'idle' } | { kind: 'rename'; id: string; name: string } | { kind: 'reauth'; ask: ReauthAsk; sentTo: string | null; value: string };

/**
 * "Chei de acces": the keys of this admin, "Creează o cheie de acces" on a supporting browser. Adding needs a confirmation no older than 10
 * minutes; when the server asks for it the section opens the re-confirmation (code or password, or Google), then adds again.
 */
export function PasskeysSection({ api, webauthn }: { api: SecurityApi; webauthn?: Webauthn }) {
  const wa = React.useMemo(() => webauthn ?? browserWebauthn(), [webauthn]);
  const [rows, setRows] = React.useState<PasskeyRow[] | null>(null);
  const [panel, setPanel] = React.useState<Panel>({ kind: 'idle' });
  const [google, setGoogle] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    const v = await api.view();
    setRows(v.passkeys);
    return v;
  }, [api]);
  React.useEffect(() => {
    load().catch((e) => setError(errorText(e)));
    api.google().then((g) => setGoogle(g.email !== null)).catch(() => setGoogle(false));
  }, [load, api]);

  const attempt = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    const made = await addKey(api, wa);
    if (made.kind === 'added') {
      adminToast.success(made.toast);
      setPanel({ kind: 'idle' });
      await load().catch((e) => setError(errorText(e)));
    } else if (made.kind === 'reauth') {
      const ask = reauthAsk(await load());
      const mail = ask.kind === 'code' && ask.method === 'email' ? await startEmailReauth(api) : null;
      if (mail && !mail.ok) setError(mail.message);
      setPanel({ kind: 'reauth', ask, sentTo: mail && mail.ok ? mail.sentTo : null, value: '' });
    } else {
      setError(made.message);
    }
    setBusy(false);
  };

  const confirm = async (): Promise<void> => {
    if (panel.kind !== 'reauth') return;
    setBusy(true);
    setError(null);
    const done = await confirmReauth(api, panel.ask, panel.value);
    if (!done.ok) {
      setError(done.message);
      setBusy(false);
      return;
    }
    setBusy(false);
    await attempt();
  };

  const run = async (job: () => Promise<{ toast: string }>): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      adminToast.success((await job()).toast);
      setPanel({ kind: 'idle' });
      await load();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section title={C.title}>
      {error && <Notice tone="danger">{error}</Notice>}
      {rows && <PasskeysList rows={rows} busy={busy} onRename={(r) => setPanel({ kind: 'rename', id: r.id, name: r.name })} onDelete={(r) => void run(() => api.passkeyDelete(r.id))} />}
      {panel.kind === 'rename' && (
        <RenameForm
          name={panel.name} busy={busy}
          onName={(name) => setPanel({ kind: 'rename', id: panel.id, name })}
          onSave={() => void run(() => api.passkeyRename(panel.id, panel.name.trim()))}
          onCancel={() => setPanel({ kind: 'idle' })}
        />
      )}
      {panel.kind === 'reauth' && (
        <ReauthForm
          ask={panel.ask} sentTo={panel.sentTo} value={panel.value} busy={busy} google={google}
          onValue={(value) => setPanel({ ...panel, value })} onConfirm={() => void confirm()} onCancel={() => setPanel({ kind: 'idle' })}
        />
      )}
      {wa.supported && panel.kind === 'idle' && (
        <div><PceButton loading={busy} onClick={() => void attempt()}>{C.create}</PceButton></div>
      )}
    </Section>
  );
}
