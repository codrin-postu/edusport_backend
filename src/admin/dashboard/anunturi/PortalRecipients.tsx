import * as React from 'react';
import { useFetchClient } from '@strapi/admin/strapi-admin';
import { Button, DataTable, Loading, Modal, Notice, Section, type DataColumn } from '../../ui';
import { ANUNT_LIST_COPY, type PortalSummary, type RecipientAccount, type RecipientsView } from '../../../club/anunturi/portal-history';

/** Content-api route of the recipients (club area) and of "Oprește". */
export const ANUNT_PORTAL_API = '/api/anunturi/portal';

const copy = ANUNT_LIST_COPY;

/** Reads the recipients of a notice (club area); `failed` also covers a role without that area. */
export function useRecipients(noticeId: string | null): { data: RecipientsView | null; failed: boolean } {
  const { get } = useFetchClient();
  const [data, setData] = React.useState<RecipientsView | null>(null);
  const [failed, setFailed] = React.useState(false);
  React.useEffect(() => {
    if (!noticeId) return undefined;
    let off = false;
    setData(null);
    setFailed(false);
    get<{ data?: RecipientsView }>(`${ANUNT_PORTAL_API}/${noticeId}`)
      .then((res) => !off && setData(res.data?.data ?? null))
      .catch(() => !off && setFailed(true));
    return () => {
      off = true;
    };
  }, [get, noticeId]);
  return { data, failed };
}

const COLUMNS: DataColumn<RecipientAccount>[] = [
  { key: 'email', header: copy.accountsHeads[0], value: (a) => a.email },
  { key: 'athletes', header: copy.accountsHeads[1], render: (a) => a.athletes.join(', ') || copy.none },
  { key: 'seen', header: copy.accountsHeads[2], render: (a) => a.seenText, width: '1%' },
];

/** The accounts a notice went to: account, athletes, seen. */
export function AccountsTable({ accounts }: { accounts: RecipientAccount[] }) {
  return <DataTable columns={COLUMNS} rows={accounts} getRowKey={(a) => a.email} pageSize={0} empty={copy.noAccounts} />;
}

/**
 * "Pe portal" block at the top of the editor of a portal announcement: how many accounts got it and how many opened it. The link to the
 * accounts list (e-mails, athlete names) is for admins with the club area only; the counts come from the list and are not personal data.
 */
export function PortalRecipients({ summary, canSeeAccounts }: { summary: PortalSummary; canSeeAccounts: boolean }) {
  const [open, setOpen] = React.useState(false);
  const { data, failed } = useRecipients(open && canSeeAccounts ? summary.noticeId : null);
  return (
    <Section title={copy.portalBlock}>
      <div className="anun-portal">
        <span>{copy.sentTo(summary.sent)}</span>
        <span>{copy.seenBy(summary.seen)}</span>
        {canSeeAccounts && (
          <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
            {copy.accountsLink}
          </Button>
        )}
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title={copy.accountsLink} size="lg" footer={<Button variant="secondary" onClick={() => setOpen(false)}>Închide</Button>}>
        {failed ? <Notice tone="danger">Nu am putut încărca conturile.</Notice> : !data ? <Loading /> : <AccountsTable accounts={data.accounts} />}
      </Modal>
    </Section>
  );
}
