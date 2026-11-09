import * as React from 'react';
import { SECURITY_COPY } from '../../../club/security/copy';
import { Modal } from '../../ui/Modal';
import { PceButton } from './PceButton';
import { mutedStyle } from './layout';
import { CODES_FILE_NAME, codesFile } from './state';

const C = SECURITY_COPY.backup;

/** The codes, the note and the three buttons. Shown once; the parent drops the codes on "Gata". */
export function BackupCodesBody({ codes, onDownload, onCopy, onDone }: { codes: string[]; onDownload: () => void; onCopy: () => void; onDone: () => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <p style={{ ...mutedStyle, margin: 0 }}>{C.note}</p>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 6, fontFamily: 'var(--ui-font-mono, monospace)', fontSize: 'var(--ui-fs-body)' }}>
        {codes.map((code) => <li key={code}>{code}</li>)}
      </ul>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <PceButton variant="secondary" onClick={onDownload}>{C.download}</PceButton>
        <PceButton variant="secondary" onClick={onCopy}>{C.copy}</PceButton>
        <PceButton onClick={onDone}>{C.done}</PceButton>
      </div>
    </div>
  );
}

function download(codes: string[]): void {
  const url = URL.createObjectURL(new Blob([codesFile(codes)], { type: 'text/plain;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = CODES_FILE_NAME;
  a.click();
  URL.revokeObjectURL(url);
}

/** "Coduri de rezervă" window; it cannot be dismissed except by "Gata", and it holds no copy of the codes beyond its props. */
export function BackupCodesWindow({ codes, onDone }: { codes: string[] | null; onDone: () => void }) {
  return (
    <Modal open={codes !== null} onClose={onDone} dismissable={false} title={C.title}>
      {codes && (
        <BackupCodesBody
          codes={codes}
          onDownload={() => download(codes)}
          onCopy={() => void navigator.clipboard?.writeText(codes.join('\n')).catch(() => undefined)}
          onDone={onDone}
        />
      )}
    </Modal>
  );
}
