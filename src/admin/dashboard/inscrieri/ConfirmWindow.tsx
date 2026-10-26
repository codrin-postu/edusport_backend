import * as React from 'react';
import { BottomSheet, Button, Loading, Notice } from '../../ui';
import type { Row } from '../SubmissionTable';
import type { RegistrationMatchView } from '../../../club/athletes/api-types';
import { CONFIRM_COPY, INSCRIERI_PENDING_COPY } from '../../../club/inscrieri-copy';
import { confirmGate, contextAthleteId, initialWindow, windowReducer, type Gate } from '../../../club/inscrieri-confirm';
import { cellText } from '../../../club/inscrieri-panel';
import { AthletePart } from './confirm/AthletePart';
import { SeasonPart } from './confirm/SeasonPart';
import { useConfirmContext, useConfirmSubmit } from './confirm/useConfirm';

type FooterProps = { gate: Gate; busy: boolean; onCancel: () => void; onConfirm: () => void };

function WindowFooter({ gate, busy, onCancel, onConfirm }: FooterProps) {
  return (
    <>
      {gate.hint && <span className="ins-foot-hint">{gate.hint}</span>}
      <Button variant="secondary" onClick={onCancel} disabled={busy}>{CONFIRM_COPY.cancel}</Button>
      <Button onClick={onConfirm} loading={busy} disabled={gate.disabled}>{CONFIRM_COPY.confirm}</Button>
    </>
  );
}

type Props = { row: Row; view: RegistrationMatchView; onClose: () => void; onDone: () => void };

/** "Confirmă înscrierea <nr>" (spec 4): a Modal on desktop, a full-height bottom sheet on phones (4.8). One at a time. */
export function ConfirmWindow({ row, view, onClose, onDone }: Props) {
  const [state, dispatch] = React.useReducer(windowReducer, view, initialWindow);
  const ctx = useConfirmContext(row.documentId, contextAthleteId(state));
  const submit = useConfirmSubmit(row.documentId, onClose, onDone);
  const gate = confirmGate(state, ctx.data, ctx.loading);
  const confirm = () => {
    if (ctx.data) void submit.run(state, ctx.data);
  };
  const footer = <WindowFooter gate={gate} busy={submit.busy} onCancel={onClose} onConfirm={confirm} />;
  return (
    <BottomSheet
      open
      onClose={onClose}
      title={CONFIRM_COPY.title(cellText(row.registrationNumber))}
      desktop="modal"
      modalSize="md"
      fullHeight
      dismissable={!submit.busy}
      bodyClassName="ins-win"
      footer={footer}
    >
      {ctx.failed && <Notice tone="danger">{INSCRIERI_PENDING_COPY.loadFailed}</Notice>}
      {!ctx.failed && !ctx.data && <Loading />}
      {ctx.data && gate.notice && <Notice tone="warning">{gate.notice}</Notice>}
      {ctx.data && <AthletePart state={state} dispatch={dispatch} ctx={ctx.data} view={view} registrationId={row.documentId} onLeave={onClose} />}
      {ctx.data && <SeasonPart state={state} dispatch={dispatch} ctx={ctx.data} schoolName={cellText(row.schoolName) || null} />}
    </BottomSheet>
  );
}
