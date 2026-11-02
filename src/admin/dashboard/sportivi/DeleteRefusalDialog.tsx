import * as React from 'react';
import { Button } from '../../ui';
import { Modal } from '../../ui/Modal';
import { anonymizeOffered, type RefusalCounts } from '../../../club/bani/delete-refusal';
import { LIFECYCLE_DELETE, deleteBlockedText } from '../../../club/presence/copy/lifecycle';

type Props = { name: string; counts: RefusalCounts; isSuperAdmin: boolean; onCancel: () => void; onAnonymize: () => void };

/** "Șterge <nume>" when payments or abonamente exist (5.14): the delete is refused; only a Super Admin may anonymize instead (C67). */
export function DeleteRefusalDialog({ name, counts, isSuperAdmin, onCancel, onAnonymize }: Props) {
  const footer = (
    <>
      <Button variant="secondary" onClick={onCancel}>{LIFECYCLE_DELETE.cancel}</Button>
      {isSuperAdmin && <Button variant="danger" className="ui-btn--solid" onClick={onAnonymize}>{LIFECYCLE_DELETE.anonymize}</Button>}
    </>
  );
  return (
    <Modal open onClose={onCancel} title={LIFECYCLE_DELETE.title(name)} role="alertdialog" footer={footer}>
      <p style={{ margin: '0 0 12px' }}>{deleteBlockedText(counts.payments, counts.subscriptions)}</p>
      {anonymizeOffered(isSuperAdmin) && <p className="ui-muted" style={{ margin: 0 }}>{LIFECYCLE_DELETE.anonymizeInstead}</p>}
    </Modal>
  );
}
