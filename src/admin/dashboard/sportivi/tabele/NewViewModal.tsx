import * as React from 'react';
import { Button, Field, Input, Modal } from '../../../ui';
import { TABLES_COPY } from '../../../../club/tables/copy';

type Props = {
  open: boolean; initialName: string;
  /** Saves the view; resolves with the server's refusal text, or null when it is saved. */
  onSave: (name: string) => Promise<string | null>;
  onClose: () => void;
};

/** "Vizualizare nouă": a name, "Renunță" and "Salvează" (inside the modal's .ui-root, so the SaveBar tagger skips them). */
export function NewViewModal({ open, initialName, onSave, onClose }: Props) {
  const [name, setName] = React.useState(initialName);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  React.useEffect(() => { if (open) { setName(initialName); setError(null); } }, [open, initialName]);
  const submit = async () => {
    if (busy || !name.trim()) return;
    setBusy(true);
    const refusal = await onSave(name.trim());
    setBusy(false);
    if (refusal) setError(refusal);
  };
  return (
    <Modal
      open={open} onClose={onClose} title={TABLES_COPY.newTitle} dismissable={!busy} initialFocusRef={inputRef}
      footer={(
        <>
          <Button variant="secondary" disabled={busy} onClick={onClose}>{TABLES_COPY.giveUp}</Button>
          <Button loading={busy} disabled={!name.trim()} onClick={() => void submit()}>{TABLES_COPY.save}</Button>
        </>
      )}
    >
      <Field label={TABLES_COPY.name} error={error} required>
        <Input ref={inputRef} value={name} maxLength={80} onChange={(e) => { setName(e.target.value); setError(null); }} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void submit(); } }} />
      </Field>
    </Modal>
  );
}
