import * as React from 'react';
import { useFetchClient } from '@strapi/admin/strapi-admin';
import { ConfirmDialog } from '../../ConfirmDialog';
import { Button, Spinner, adminToast } from '../../ui';
import { DetailField, fmtDateTime, type Row } from '../SubmissionTable';
import {
  emailStatusText,
  failedEmailError,
  readEmailStatus,
  requestErrorText,
  resendTarget,
  resendToast,
  type EmailStatus,
} from '../../../club/registration-panel';

/** E-mail routes of plan 2F. */
const emailUrl = (documentId: string, action: 'email-status' | 'resend-email') => `/api/club/registrations/${documentId}/${action}`;

/** The e-mail job of one registration, loaded when the panel opens on it. */
function useEmailStatus(documentId: string) {
  const { get } = useFetchClient();
  const [status, setStatus] = React.useState<EmailStatus | null>(null);
  const [loaded, setLoaded] = React.useState(false);
  React.useEffect(() => {
    let off = false;
    setLoaded(false);
    get(emailUrl(documentId, 'email-status'))
      .then((r) => !off && setStatus(readEmailStatus(r.data)))
      .catch(() => !off && setStatus(null))
      .finally(() => !off && setLoaded(true));
    return () => {
      off = true;
    };
    // get changes identity on every render; the status depends on the registration only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId]);
  return { status, setStatus, loaded };
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

/** E-mail status in the Înscrieri panel; the confirmation names the recipient and the documents. */
export function RegistrationEmail({ row }: { row: Row }) {
  const email = useEmailStatus(row.documentId);
  const { busy, resend } = useResend(row.documentId, (s) => s && email.setStatus(s));
  const [confirming, setConfirming] = React.useState(false);
  const target = resendTarget(email.status, row);
  const confirm = async () => (await resend()) && setConfirming(false);
  return (
    <DetailField label="E-mail">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {email.loaded ? <span>{emailStatusText(email.status, fmtDateTime)}</span> : <Spinner size={12} />}
        <Button size="sm" variant="secondary" onClick={() => setConfirming(true)}>
          Retrimite e-mailul
        </Button>
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
