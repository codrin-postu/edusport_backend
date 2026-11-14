import * as React from 'react';
import { Button, Loading, Modal, Notice } from '../../ui';
import { ANUNT_LIST_COPY, type ListRow } from '../../../club/anunturi/portal-history';
import { shortDay } from '../../../club/portal/notices/copy';
import { AccountsTable, useRecipients } from './PortalRecipients';

const copy = ANUNT_LIST_COPY;

/**
 * Read-only detail of an automatic message (cancelled or moved sessions): what it says and, for the club area, the account it went to. No
 * field can be changed here.
 */
export function AutoNoticeView({ row, canSeeAccounts, onClose }: { row: ListRow; canSeeAccounts: boolean; onClose: () => void }) {
  const { data, failed } = useRecipients(canSeeAccounts ? row.id : null);
  return (
    <Modal open onClose={onClose} title={row.title} size="md" footer={<Button variant="secondary" onClick={onClose}>Închide</Button>}>
      <div className="ui-stack">
        <p className="ui-muted">{[copy.auto, row.period].join(', ')}</p>
        {canSeeAccounts && failed && <Notice tone="danger">Nu am putut încărca detaliile.</Notice>}
        {canSeeAccounts && !failed && !data && <Loading />}
        {data && (
          <>
            <ul className="anun-auto-rows">
              {data.rows.map((r) => (
                <li key={`${r.date}-${r.text}`}>
                  <b>{shortDay(r.date)}</b> {r.text}
                  {r.reason && <span className="ui-muted">{`, ${r.reason}`}</span>}
                </li>
              ))}
            </ul>
            <p>{`${data.sentTo}. ${data.seenBy}.`}</p>
            <AccountsTable accounts={data.accounts} />
          </>
        )}
        {!canSeeAccounts && row.subline && <p className="ui-muted">{row.subline}</p>}
      </div>
    </Modal>
  );
}
