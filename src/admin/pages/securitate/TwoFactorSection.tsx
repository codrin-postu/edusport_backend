import * as React from 'react';
import type { SecurityView } from '../../../club/security/api-types';
import { SECURITY_COPY } from '../../../club/security/copy';
import { ConfirmDialog } from '../../ConfirmDialog';
import { Field } from '../../ui/Field';
import { Input } from '../../ui/Input';
import { Notice } from '../../ui/Notice';
import { Section } from '../../ui/Section';
import { adminToast } from '../../ui/Toast';
import { errorText } from './errors';
import { BackupCodesWindow } from './BackupCodesWindow';
import type { SecurityApi } from './client';
import { Row, mutedStyle, stackStyle } from './layout';
import { PceButton } from './PceButton';
import {
  anyMethod, askOff, confirmEmail, confirmTotp, INITIAL, newBatch, offTitle, reduce, startEmail, startTotp, turnOff,
  type Action, type Method, type Panel,
} from './state';

const C = SECURITY_COPY.twoFactor;
const B = SECURITY_COPY.backup;

type RowsProps = { view: SecurityView; busy: boolean; onEnable: (m: Method) => void; onDisable: (m: Method) => void; onRegenerate: () => void };

/** The method rows: "Activ" / "Oprit" with "Activează" / "Oprește", and the backup codes row once a method is on. */
export function TwoFactorRows({ view, busy, onEnable, onDisable, onRegenerate }: RowsProps) {
  const methods: Array<{ method: Method; label: string; on: boolean }> = [
    { method: 'totp', label: C.app, on: view.totp },
    { method: 'email', label: C.email, on: view.emailCode },
  ];
  return (
    <>
      {methods.map(({ method, label, on }, i) => (
        <Row key={method} first={i === 0}>
          <span>{label}</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={mutedStyle}>{on ? C.active : C.off}</span>
            <PceButton variant="secondary" size="sm" disabled={busy} onClick={() => (on ? onDisable(method) : onEnable(method))}>
              {on ? C.disable : C.enable}
            </PceButton>
          </span>
        </Row>
      ))}
      {anyMethod(view) && (
        <Row>
          <span>{B.title}</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={mutedStyle}>{B.left(view.backupLeft)}</span>
            <PceButton variant="secondary" size="sm" disabled={busy} onClick={onRegenerate}>{B.generate}</PceButton>
          </span>
        </Row>
      )}
    </>
  );
}

type SetupProps = { code: string; busy: boolean; onCode: (v: string) => void; onConfirm: () => void; onCancel: () => void };

function SetupActions({ code, busy, onCode, onConfirm, onCancel, label }: SetupProps & { label: string }) {
  return (
    <>
      <Field label={label}>
        <Input value={code} autoComplete="one-time-code" onChange={(e) => onCode(e.target.value)} />
      </Field>
      <div style={{ display: 'flex', gap: 8 }}>
        <PceButton loading={busy} disabled={code.trim() === ''} onClick={onConfirm}>{C.enable}</PceButton>
        <PceButton variant="secondary" disabled={busy} onClick={onCancel}>{C.cancel}</PceButton>
      </div>
    </>
  );
}

/** App setup: the QR (an SVG from our server, shown as an image), the text key, then the code. */
export function TotpSetup(p: SetupProps & { qrSvg: string; keyText: string }) {
  return (
    <div style={stackStyle}>
      <p style={{ margin: 0 }}>{C.appScan}</p>
      <img alt="" width={168} height={168} src={`data:image/svg+xml;utf8,${encodeURIComponent(p.qrSvg)}`} />
      <p style={{ ...mutedStyle, margin: 0 }}>{C.appKey(p.keyText)}</p>
      <SetupActions {...p} label={C.appCode} />
    </div>
  );
}

export function EmailSetup(p: SetupProps & { sentTo: string }) {
  return (
    <div style={stackStyle}>
      <p style={{ margin: 0 }}>{C.emailSent(p.sentTo)}</p>
      <SetupActions {...p} label={C.emailCode} />
    </div>
  );
}

/** "2FA": the rows, the app or e-mail setup under them, the turn-off and new-codes confirmations, and the backup codes window. */
export function TwoFactorSection({ api }: { api: SecurityApi }) {
  const [state, dispatch] = React.useReducer(reduce, INITIAL);
  const [busy, setBusy] = React.useState(false);
  const [code, setCode] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let live = true;
    api.view().then((view) => live && dispatch({ type: 'view', view, first: true })).catch((e) => live && setError(errorText(e)));
    return () => {
      live = false;
    };
  }, [api]);

  /** Runs one change; every action it returns is dispatched, and a toast action shows the server's text. Returns whether it worked. */
  const run = async (work: () => Promise<Action[]>): Promise<boolean> => {
    setBusy(true);
    setError(null);
    try {
      for (const a of await work()) {
        dispatch(a);
        if (a.type === 'toast') adminToast.success(a.toast);
      }
      setCode('');
      return true;
    } catch (e) {
      setError(errorText(e));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const { view, panel } = state;
  const open = (p: Panel): void => {
    setCode('');
    setError(null);
    dispatch({ type: 'panel', panel: p });
  };
  const close = (): void => open({ kind: 'idle' });
  const confirmOff = (): Promise<boolean> => (panel.kind === 'off' ? run(() => turnOff(api, panel.method)) : Promise.resolve(false));

  return (
    <Section title={C.title}>
      {state.notice !== null && <Notice tone="info">{B.backupLeft(state.notice)}</Notice>}
      {error && <Notice tone="danger">{error}</Notice>}
      {view && (
        <TwoFactorRows
          view={view}
          busy={busy}
          onEnable={(m) => void run(() => (m === 'totp' ? startTotp(api) : startEmail(api)))}
          onDisable={(m) => open(askOff(view, m))}
          onRegenerate={() => open({ kind: 'regenerate' })}
        />
      )}
      {panel.kind === 'totp' && (
        <TotpSetup qrSvg={panel.qrSvg} keyText={panel.key} code={code} busy={busy} onCode={setCode} onCancel={close} onConfirm={() => void run(() => confirmTotp(api, code))} />
      )}
      {panel.kind === 'email' && (
        <EmailSetup sentTo={panel.sentTo} code={code} busy={busy} onCode={setCode} onCancel={close} onConfirm={() => void run(() => confirmEmail(api, code))} />
      )}
      <ConfirmDialog
        open={panel.kind === 'off'}
        title={panel.kind === 'off' ? offTitle(panel.method, panel.last) : ''}
        message={null}
        confirmLabel={C.confirmOff}
        busyLabel={C.confirmOff}
        cancelLabel={C.cancel}
        busy={busy}
        error={panel.kind === 'off' ? error : null}
        onCancel={close}
        onConfirm={() => void confirmOff()}
      />
      <ConfirmDialog
        open={panel.kind === 'regenerate'}
        title={B.generate}
        message={B.generateConfirm}
        confirmLabel={B.generate}
        busyLabel={B.generate}
        cancelLabel={C.cancel}
        tone="default"
        busy={busy}
        error={panel.kind === 'regenerate' ? error : null}
        onCancel={close}
        onConfirm={() => void run(() => newBatch(api))}
      />
      <BackupCodesWindow codes={state.codes} onDone={() => dispatch({ type: 'codesDone' })} />
    </Section>
  );
}
