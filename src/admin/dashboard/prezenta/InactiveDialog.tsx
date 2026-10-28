import * as React from 'react';
import { Button, Modal } from '../../ui';
import { REACTIVATE_DIALOG } from '../../../club/presence/copy/attendance';
import type { InactiveAthlete } from '../../../club/presence/attendance/api-types';

type Props = { athlete: InactiveAthlete; busy?: boolean; onAnswer: (reactivate: boolean) => void };

/** "Sportiv inactiv" (4.22): one answer per inactive athlete a save was refused for. Answering is the only way out. */
export function InactiveDialog({ athlete, busy = false, onAnswer }: Props) {
  const footer = (
    <>
      <Button variant="secondary" disabled={busy} onClick={() => onAnswer(false)}>{REACTIVATE_DIALOG.keep}</Button>
      <Button disabled={busy} onClick={() => onAnswer(true)}>{REACTIVATE_DIALOG.reactivate}</Button>
    </>
  );
  return (
    <Modal open title={REACTIVATE_DIALOG.title} role="alertdialog" dismissable={false} onClose={() => undefined} footer={footer}>
      <p style={{ margin: 0 }}>{REACTIVATE_DIALOG.text(athlete.name)}</p>
    </Modal>
  );
}
