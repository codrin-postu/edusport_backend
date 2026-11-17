import * as React from 'react';
import { Button, Modal, Textarea, adminToast } from '../../ui';
import { IconCopy, IconWarning, IconWhatsapp } from '../../ui/icons';
import type { Row, TableApi } from '../SubmissionTable';
import { PHONE_COPY, smsUrl, whatsappMessage, whatsappUrl } from '../../../club/inscrieri-phone';
import { cellText, isAnonymizedRow } from '../../../club/inscrieri-panel';
import { formatPhone, normalizePhone } from '../../../club/phone';

const BTN = 'ui-btn ui-btn--ghost ui-btn--sm ui-btn--icon';

/** WhatsApp / SMS popup: the message is edited here, WhatsApp and SMS open their apps, the status is changed on return (saved like the panel status). */
function WhatsappDialog({ row, api, raw, onClose }: { row: Row; api: TableApi; raw: string; onClose: () => void }) {
  const [text, setText] = React.useState(() => whatsappMessage({ parinte: cellText(row.parentName), copil: cellText(row.childName) }));
  const url = whatsappUrl(raw, text);
  const sms = smsUrl(raw, text);
  const open = () => {
    if (url) window.location.href = url;
  };
  const openSms = () => {
    if (sms) window.location.href = sms;
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={formatPhone(raw).text}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {PHONE_COPY.close}
          </Button>
          <Button variant="secondary" disabled={!sms} onClick={openSms}>
            {PHONE_COPY.sms}
          </Button>
          <Button disabled={!url} onClick={open}>
            {PHONE_COPY.whatsapp}
          </Button>
        </>
      }
    >
      <Textarea rows={5} aria-label={PHONE_COPY.whatsapp} value={text} onChange={(e) => setText(e.target.value)} />
      {api.statusBox(row)}
    </Modal>
  );
}

/** The phone number with a copy button and a WhatsApp popup; archived and anonymized rows show the number only. */
export function PhoneActions({ row, api }: { row: Row; api: TableApi }) {
  const [dialog, setDialog] = React.useState(false);
  const raw = cellText(row.phone);
  const shown = formatPhone(raw);
  const readOnly = isAnonymizedRow(row) || row.archived === true;
  if (readOnly || !raw) return <span className="ins-phone">{shown.text}</span>;

  const copy = () => {
    const text = normalizePhone(raw) ?? raw;
    navigator.clipboard?.writeText(text).then(
      () => adminToast.success(PHONE_COPY.copied),
      () => undefined,
    );
  };

  return (
    <span className="ins-phone">
      <span>{shown.text}</span>
      {!shown.valid && (
        <span className="ins-phone-warn" role="img" title={PHONE_COPY.invalid} aria-label={PHONE_COPY.invalid}>
          <IconWarning />
        </span>
      )}
      <button type="button" className={BTN} aria-label={PHONE_COPY.copy} title={PHONE_COPY.copy} onClick={copy}>
        <IconCopy />
      </button>
      {whatsappUrl(raw, '') && (
        <button type="button" className={BTN} aria-label={PHONE_COPY.send} title={PHONE_COPY.send} onClick={() => setDialog(true)}>
          <IconWhatsapp />
        </button>
      )}
      {dialog && (
        <span onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
          <WhatsappDialog row={row} api={api} raw={raw} onClose={() => setDialog(false)} />
        </span>
      )}
    </span>
  );
}
