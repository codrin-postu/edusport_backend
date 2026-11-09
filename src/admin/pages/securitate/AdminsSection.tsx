import * as React from 'react';
import { SECURITY_COPY } from '../../../club/security/copy';
import { ConfirmDialog } from '../../ConfirmDialog';
import { Notice } from '../../ui/Notice';
import { Section } from '../../ui/Section';
import { adminToast } from '../../ui/Toast';
import { errorText } from './errors';
import type { AdminListRow, SecurityApi } from './client';
import { Row, mutedStyle } from './layout';
import { PceButton } from './PceButton';

const C = SECURITY_COPY.admins;

/** One row per admin: name, e-mail, "2FA activ" / "2FA oprit", and "Resetează 2FA" except on the caller's own row (ruling 6). */
export function AdminsList({ rows, busy, onReset }: { rows: AdminListRow[]; busy: boolean; onReset: (r: AdminListRow) => void }) {
  return (
    <>
      {rows.map((r, i) => (
        <Row key={r.id} first={i === 0}>
          <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span>{r.name}</span>
            <span style={mutedStyle}>{r.email}</span>
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={mutedStyle}>{r.twoFactor ? C.on : C.off}</span>
            {!r.self && <PceButton variant="secondary" size="sm" disabled={busy} onClick={() => onReset(r)}>{C.reset}</PceButton>}
          </span>
        </Row>
      ))}
    </>
  );
}

/** "Administratori" (Super Admin only; the server route refuses anyone else). */
export function AdminsSection({ api }: { api: SecurityApi }) {
  const [rows, setRows] = React.useState<AdminListRow[] | null>(null);
  const [target, setTarget] = React.useState<AdminListRow | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(() => api.admins().then(setRows), [api]);
  React.useEffect(() => {
    load().catch((e) => setError(errorText(e)));
  }, [load]);

  const reset = async (): Promise<void> => {
    if (!target) return;
    setBusy(true);
    setError(null);
    try {
      adminToast.success((await api.resetAdmin(target.id)).toast);
      setTarget(null);
      await load();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section title={C.title}>
      {!target && error && <Notice tone="danger">{error}</Notice>}
      {rows && <AdminsList rows={rows} busy={busy} onReset={(r) => { setError(null); setTarget(r); }} />}
      <ConfirmDialog
        open={target !== null}
        title={C.reset}
        message={target ? C.confirmReset(target.name) : null}
        confirmLabel={C.reset}
        busyLabel={C.reset}
        cancelLabel={SECURITY_COPY.twoFactor.cancel}
        busy={busy}
        error={target ? error : null}
        onCancel={() => setTarget(null)}
        onConfirm={() => void reset()}
      />
    </Section>
  );
}
