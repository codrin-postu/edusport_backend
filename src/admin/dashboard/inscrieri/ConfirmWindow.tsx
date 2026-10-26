import * as React from 'react';
import { BottomSheet, Button, Loading, Notice } from '../../ui';
import type { Row } from '../SubmissionTable';
import type { RegistrationMatchView } from '../../../club/athletes/api-types';
import { CONFIRM_COPY, INSCRIERI_PENDING_COPY } from '../../../club/inscrieri-copy';
import { confirmGate, contextAthleteId, initialWindow, windowReducer, type Gate, type WindowAction, type WindowState } from '../../../club/inscrieri-confirm';
import { cellText } from '../../../club/inscrieri-panel';
import { AthletePart } from './confirm/AthletePart';
import { SeasonPart } from './confirm/SeasonPart';
import { useConfirmContext, useConfirmSubmit, type ContextState } from './confirm/useConfirm';

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

type BodyProps = Props & { state: WindowState; dispatch: React.Dispatch<WindowAction>; ctx: ContextState; notice: string | null; busy: boolean };

/** The first load failing ends here; a failed reload after a switch keeps the last answer (AthletePart shows the notice). */
function WindowBody({ row, view, onClose, state, dispatch, ctx, notice, busy }: BodyProps) {
  const data = ctx.data;
  if (!data) return ctx.failed ? <Notice tone="danger">{INSCRIERI_PENDING_COPY.loadFailed}</Notice> : <Loading />;
  const stale = ctx.loading || ctx.failed;
  return (
    <>
      {notice && <Notice tone="warning">{notice}</Notice>}
      <AthletePart state={state} dispatch={dispatch} ctx={data} view={view} registrationId={row.documentId} failed={ctx.failed} onLeave={onClose} busy={busy} stale={stale} />
      {!ctx.failed && <SeasonPart state={state} dispatch={dispatch} ctx={data} busy={busy} schoolName={cellText(row.schoolName) || null} />}
    </>
  );
}

/** "Confirmă înscrierea <nr>" (spec 4): a Modal on desktop, a full-height bottom sheet on phones (4.8). One at a time. */
export function ConfirmWindow({ row, view, onClose, onDone }: Props) {
  const [state, dispatch] = React.useReducer(windowReducer, view, initialWindow);
  const ctx = useConfirmContext(row.documentId, contextAthleteId(state));
  const submit = useConfirmSubmit(row.documentId, onClose, onDone);
  const gate = confirmGate(state, ctx.failed ? null : ctx.data, ctx.loading);
  const confirm = () => {
    if (ctx.data && !gate.disabled) void submit.run(state, ctx.data);
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
      <WindowBody row={row} view={view} onClose={onClose} onDone={onDone} state={state} dispatch={dispatch} ctx={ctx} notice={gate.notice} busy={submit.busy} />
    </BottomSheet>
  );
}
