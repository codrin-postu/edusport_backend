import * as React from 'react';
import { BottomSheet, Button } from '../../ui';
import { PHONE_SELECT } from '../../../club/inscrieri-card';

export type PhoneSelectBarProps = {
  count: number;
  busy: boolean;
  canMove: boolean;
  canArchive: boolean;
  onMove: () => void;
  onArchive: () => void;
  onDelete: () => void;
};

/** Phone selection: the bar fixed at the bottom with the desktop bulk actions; nothing ticked disables them. */
export function PhoneSelectBar({ count, busy, canMove, canArchive, onMove, onArchive, onDelete }: PhoneSelectBarProps) {
  const off = count === 0 || busy;
  return (
    <div className="sbt-pselbar">
      {canMove && (
        <Button size="sm" onClick={onMove} disabled={off}>
          {PHONE_SELECT.move}
        </Button>
      )}
      {canArchive && (
        <Button size="sm" variant="secondary" onClick={onArchive} disabled={off}>
          Arhivează
        </Button>
      )}
      <Button size="sm" variant="danger" onClick={onDelete} disabled={off}>
        Șterge
      </Button>
    </div>
  );
}

/** Phone selection header actions: tick every card on the page, leave selection. */
export function PhoneSelectActions({ onAll, onDone }: { onAll: () => void; onDone: () => void }) {
  return (
    <>
      <Button size="sm" variant="ghost" onClick={onAll}>
        {PHONE_SELECT.all}
      </Button>
      <Button size="sm" variant="secondary" onClick={onDone}>
        {PHONE_SELECT.done}
      </Button>
    </>
  );
}

/** "Mută...": the season move and, with several schools, the school move, as on the desktop bulk bar. */
export function PhoneMoveSheet({ open, count, onClose, children }: { open: boolean; count: number; onClose: () => void; children: React.ReactNode }) {
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={PHONE_SELECT.moveTitle(count)}
      footer={
        <Button variant="secondary" onClick={onClose}>
          {PHONE_SELECT.close}
        </Button>
      }
    >
      <div className="sbt-pmove">{children}</div>
    </BottomSheet>
  );
}
