import * as React from 'react';
import { adminToast } from '../../ui';
import { IconCopy, IconWarning, IconWhatsapp } from '../../ui/icons';
import type { Row, TableApi } from '../SubmissionTable';
import { PHONE_COPY, statusAfterWhatsapp, whatsappUrl } from '../../../club/inscrieri-phone';
import { cellText, isAnonymizedRow, registrationStatus } from '../../../club/inscrieri-panel';
import { formatPhone, normalizePhone } from '../../../club/phone';

const BTN = 'ui-btn ui-btn--ghost ui-btn--sm ui-btn--icon';

/** The phone number with a copy button and a WhatsApp link; archived and anonymized rows show the number only. */
export function PhoneActions({ row, api }: { row: Row; api: TableApi }) {
  const raw = cellText(row.phone);
  const shown = formatPhone(raw);
  const readOnly = isAnonymizedRow(row) || row.archived === true;
  const url = whatsappUrl(raw, { parinte: cellText(row.parentName), copil: cellText(row.childName) });
  if (readOnly || !raw) return <span className="ins-phone">{shown.text}</span>;

  const copy = () => {
    const text = normalizePhone(raw) ?? raw;
    navigator.clipboard?.writeText(text).then(
      () => adminToast.success(PHONE_COPY.copied),
      () => undefined,
    );
  };
  const contacted = () => {
    const next = statusAfterWhatsapp(registrationStatus(row));
    if (next) api.saveField(row.documentId, 'status', next);
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
      {url && (
        <a className={BTN} href={url} target="_blank" rel="noopener noreferrer" aria-label={PHONE_COPY.whatsapp} title={PHONE_COPY.whatsapp} onClick={contacted}>
          <IconWhatsapp />
        </a>
      )}
    </span>
  );
}
