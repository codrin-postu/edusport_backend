import * as React from 'react';
import { BottomSheet, Button, Loading, Radio, adminToast } from '../../ui';
import { ConfirmDialog } from '../../ConfirmDialog';
import type { AthleteRecord, MergePreview } from '../../../club/athletes/api-types';
import { ADMIN_ERRORS } from '../../../club/athletes/errors';
import { requestErrorText } from '../../../club/registration-panel';
import {
  MERGE_COPY, SIDES, initialMerge, keptName, mergeRequest, mergeRows, pickOf, sides, withKept, withPick, type MergeRow, type MergeState,
} from '../../../club/sportivi/merge-view';
import type { SportiviApi } from './api';
import { AthleteSearch } from './AthleteSearch';

export type MergeDialogProps = {
  record: AthleteRecord;
  otherId: string | null;
  api: SportiviApi;
  onClose: () => void;
  onMerged: (keptId: string) => void;
};

function useMergePreview(api: SportiviApi, keptId: string, otherId: string | null, onFail: () => void): MergePreview | null {
  const [preview, setPreview] = React.useState<MergePreview | null>(null);
  const fail = React.useRef(onFail);
  fail.current = onFail;
  React.useEffect(() => {
    setPreview(null);
    if (!otherId) return undefined;
    let off = false;
    api.mergePreview(keptId, otherId)
      .then((p) => { if (!off) setPreview(p); })
      .catch((err) => {
        if (off) return;
        adminToast.error(requestErrorText(err, ADMIN_ERRORS.failed));
        fail.current();
      });
    return () => { off = true; };
  }, [api, keptId, otherId]);
  return preview;
}

type TableProps = { preview: MergePreview; state: MergeState; onChange: (s: MergeState) => void };

function MergeFieldRow({ row, state, onChange }: { row: MergeRow } & Omit<TableProps, 'preview'>) {
  return (
    <tr>
      <th scope="row">{row.label}</th>
      {SIDES.map((side) => (
        <td key={side} className={row.differs ? 'spv-diff' : undefined}>
          {row.differs ? (
            <Radio name={`spv-${row.field}`} value={side} checked={pickOf(state, row.field) === side} onChange={() => onChange(withPick(state, row.field, side))} label={row[side]} />
          ) : (
            row[side]
          )}
        </td>
      ))}
    </tr>
  );
}

function MergeTable({ preview, state, onChange }: TableProps) {
  const v = sides(preview);
  return (
    <div className="spv-merge-wrap">
      <table className="spv-merge">
        <thead>
          <tr>
            <td />
            {SIDES.map((side) => (
              <th key={side} scope="col">
                <span className="spv-name">{v[side].name}</span>
                <Radio name="spv-kept" value={side} checked={state.kept === side} onChange={() => onChange(withKept(side))} label={MERGE_COPY.kept} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {mergeRows(preview).map((row) => <MergeFieldRow key={row.field} row={row} state={state} onChange={onChange} />)}
          <tr><th scope="row">{MERGE_COPY.profile}</th><td>{v.a.profileSlug}</td><td>{v.b.profileSlug}</td></tr>
          <tr><th scope="row">{MERGE_COPY.registrations}</th><td>{v.a.registrations}</td><td>{v.b.registrations}</td></tr>
        </tbody>
      </table>
    </div>
  );
}

/** "Unește cu alt sportiv" (spec 6.6): the kept record and, per differing field, the value that stays; no undo. */
export function MergeDialog({ record, otherId, api, onClose, onMerged }: MergeDialogProps) {
  const [other, setOther] = React.useState<string | null>(otherId);
  const preview = useMergePreview(api, record.documentId, other, () => setOther(null));
  const [state, setState] = React.useState<MergeState>(initialMerge);
  const [confirming, setConfirming] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  React.useEffect(() => setState(initialMerge()), [preview]);
  const submit = async () => {
    if (!preview) return;
    const req = mergeRequest(preview, state);
    setBusy(true);
    setError(null);
    try {
      onMerged((await api.merge(req.keptId, req.removedId, req.take)).documentId);
    } catch (err) {
      setError(requestErrorText(err, ADMIN_ERRORS.failed));
      setBusy(false);
    }
  };
  const footer = (
    <>
      <Button variant="secondary" onClick={onClose} disabled={busy}>{MERGE_COPY.cancel}</Button>
      <Button onClick={() => setConfirming(true)} disabled={!preview || busy}>{MERGE_COPY.submit}</Button>
    </>
  );
  const body = !other ? (
    <AthleteSearch api={api} exclude={record.documentId} onPick={(c) => setOther(c.documentId)} />
  ) : preview ? (
    <MergeTable preview={preview} state={state} onChange={setState} />
  ) : (
    <Loading />
  );
  return (
    <>
      <BottomSheet open onClose={onClose} title={MERGE_COPY.title} desktop="modal" modalSize="lg" fullHeight dismissable={!busy} footer={footer}>
        {body}
      </BottomSheet>
      <ConfirmDialog
        open={confirming && preview !== null}
        title={MERGE_COPY.confirmTitle}
        message={preview ? MERGE_COPY.confirmMessage(keptName(preview, state)) : ''}
        confirmLabel={MERGE_COPY.confirmLabel}
        busyLabel={MERGE_COPY.confirmLabel}
        busy={busy}
        error={error}
        onCancel={() => { if (!busy) { setConfirming(false); setError(null); } }}
        onConfirm={() => void submit()}
      />
    </>
  );
}
