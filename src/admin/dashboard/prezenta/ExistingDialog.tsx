import * as React from 'react';
import { Button, Modal } from '../../ui';
import { EXISTING_SESSION } from '../../../club/presence/copy/attendance';
import type { SessionCheck } from '../../../club/presence/attendance/api-types';
import { existingLine } from '../../../club/prezenta/day-view';

type Existing = Extract<SessionCheck, { kind: 'existing' }>;
type Props = { check: Existing; onOpenSaved: (sessionId: string) => void; onAddAnother: () => void; onClose: () => void };

/** The warning of "Ședință nouă" (4.5): a session is saved that day. "Deschide" opens the earliest one; "Adaugă încă o ședință" is not offered for the same start time. */
export function ExistingDialog({ check, onOpenSaved, onAddAnother, onClose }: Props) {
  const earliest = [...check.saved].sort((a, b) => a.startTime.localeCompare(b.startTime))[0];
  const footer = (
    <>
      {!check.sameTime && <Button variant="secondary" onClick={onAddAnother}>{EXISTING_SESSION.addAnother}</Button>}
      <Button onClick={() => onOpenSaved(earliest.sessionId)}>{EXISTING_SESSION.open}</Button>
    </>
  );
  return (
    <Modal open title={EXISTING_SESSION.title} role="alertdialog" onClose={onClose} footer={footer}>
      <ul className="spv-rows">
        {check.saved.map((s) => <li key={s.sessionId}>{existingLine(s)}</li>)}
      </ul>
    </Modal>
  );
}
