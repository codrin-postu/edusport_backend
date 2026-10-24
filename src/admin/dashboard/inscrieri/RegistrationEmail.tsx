import * as React from 'react';
import { useFetchClient } from '@strapi/admin/strapi-admin';
import { ConfirmDialog } from '../../ConfirmDialog';
import { Button, Spinner, adminToast } from '../../ui';
import { DetailField, type Row } from '../SubmissionTable';
import {
  EMAIL_LOAD_FAILED_TEXT,
  emailPanelState,
  emailStatusText,
  failedEmailError,
  formatEmailSentAt,
  readEmailStatus,
  requestErrorText,
  resendTarget,
  resendToast,
  type EmailPanelState,
  type EmailStatus,
} from '../../../club/registration-panel';

/** E-mail routes of plan 2F. */
const emailUrl = (documentId: string, action: 'email-status' | 'resend-email') => `/api/club/registrations/${documentId}/${action}`;

/** The e-mail job of one registration, loaded when the panel opens on it; `reload` re-runs the GET. */
function useEmailStatus(documentId: string) {
  const { get } = useFetchClient();
  const getRef = React.useRef(get);
  getRef.current = get;
  const [status, setStatus] = React.useState<EmailStatus | null>(null);
  const [loaded, setLoaded] = React.useState(false);
  const [loadFailed, setLoadFailed] = React.useState(false);
  const load = React.useCallback(() => {
    let off = false;
    setLoaded(false);
    setLoadFailed(false);
    getRef
      .current(emailUrl(documentId, 'email-status'))
      .then((r) => !off && setStatus(readEmailStatus(r.data)))
      .catch(() => !off && setLoadFailed(true))
      .finally(() => !off && setLoaded(true));
    return () => {
      off = true;
    };
  }, [documentId]);
  React.useEffect(() => load(), [load]);
  return { status, setStatus, loaded, loadFailed, reload: load };
}

/** "Retrimite e-mailul": 2F logs it in history and tries once at once; resolves true on success. */
function useResend(documentId: string, onStatus: (s: EmailStatus | null) => void) {
  const { post } = useFetchClient();
  const [busy, setBusy] = React.useState(false);
  const resend = async () => {
    setBusy(true);
    try {
      const status = readEmailStatus((await post(emailUrl(documentId, 'resend-email'))).data);
      onStatus(status);
      const toast = resendToast(status);
      adminToast[toast.tone](toast.text);
      return true;
    } catch (err) {
      adminToast.error(requestErrorText(err, 'Nu am putut retrimite e-mailul.'));
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { busy, resend };
}

/** The block inside the "E-mail" field: a spinner, the reload prompt, or the status and resend button. */
function EmailStatusDisplay({
  view,
  status,
  onReload,
  onResend,
}: {
  view: EmailPanelState;
  status: EmailStatus | null;
  onReload: () => void;
  onResend: () => void;
}) {
  if (view === 'loading') return <Spinner size={12} />;
  if (view === 'load-failed') {
    return (
      <>
        <span>{EMAIL_LOAD_FAILED_TEXT}</span>
        <Button size="sm" variant="secondary" onClick={onReload}>
          Reîncarcă
        </Button>
      </>
    );
  }
  return (
    <>
      <span>{emailStatusText(status, formatEmailSentAt)}</span>
      <Button size="sm" variant="secondary" onClick={onResend}>
        Retrimite e-mailul
      </Button>
    </>
  );
}

/** E-mail status in the Înscrieri panel; the confirmation names the recipient and the documents. */
export function RegistrationEmail({ row }: { row: Row }) {
  const email = useEmailStatus(row.documentId);
  const { busy, resend } = useResend(row.documentId, (s) => s && email.setStatus(s));
  const [confirming, setConfirming] = React.useState(false);
  const target = resendTarget(email.status, row);
  const confirm = async () => (await resend()) && setConfirming(false);
  const view = emailPanelState(email.loaded, email.loadFailed);
  return (
    <DetailField label="E-mail">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <EmailStatusDisplay view={view} status={email.status} onReload={email.reload} onResend={() => setConfirming(true)} />
      </div>
      {failedEmailError(email.status) && <div className="ui-error">{failedEmailError(email.status)}</div>}
      <ConfirmDialog
        open={confirming}
        title="Retrimiți e-mailul?"
        message={`Către: ${target.recipient}`}
        detail={`Documente: ${target.documents.join(', ')}`}
        confirmLabel="Retrimite"
        busyLabel="Se trimite..."
        tone="default"
        busy={busy}
        onConfirm={() => void confirm()}
        onCancel={() => setConfirming(false)}
      />
    </DetailField>
  );
}
