import * as React from 'react';
import { useFetchClient } from '@strapi/admin/strapi-admin';
import { ConfirmDialog } from '../ConfirmDialog';
import { Modal, Button, Field, Input, Select, Notice, Loading, adminToast, toastAutosaved } from '../ui';

/**
 * EduSport admin — the Google Sheets connect-and-schedule window.
 *
 * Shared by every form list. Opened from the Export menu of a submission table
 * (see SubmissionTable.tsx) and driven entirely by the admin-guarded endpoints
 * under /api/sheets:
 *
 *   GET  /api/sheets/status              credential state + one entry per form
 *   POST /api/sheets/:form/verify        { link } -> real title, or a typed reason
 *   POST /api/sheets/:form/connect       { spreadsheetId, spreadsheetName }
 *   POST /api/sheets/:form/create        new spreadsheet, shared + connected
 *   POST /api/sheets/:form/disconnect
 *   POST /api/sheets/:form/sync          full resync now
 *   GET  /api/sheets/:form/history       last 20 runs
 *   POST /api/sheets/:form/schedule      { intervalHours: 0 | 1 | 4 | 8 | 24 }
 *
 * The component is form-agnostic: it takes a form key and a label, so the two
 * inbox screens (Parteneri, Contact) can be switched on later without changes
 * here. `schedule` is the newest endpoint; a 404 from it is reported as "not
 * available on the server yet" instead of a generic failure.
 *
 * Built on the shared Modal (Escape, backdrop, focus trap, stacking with the
 * disconnect ConfirmDialog), Field / Input / Select / Button, Notice for the
 * state boxes and the .ui-table classes for the history. Action results
 * (connected, synced, a failed action) are toasts; a failed status load stays
 * as a Notice in the dialog.
 */

export type SheetsForm = 'inscrieri' | 'voluntari' | 'parteneri' | 'contact';

const SHEETS_API = '/api/sheets';

/** Allowed reconcile intervals, in the order the dropdown shows them. */
const INTERVALS: { value: number; label: string }[] = [
  { value: 1, label: 'la fiecare oră' },
  { value: 4, label: 'la fiecare 4 ore' },
  { value: 8, label: 'la fiecare 8 ore' },
  { value: 24, label: 'o dată pe zi' },
  { value: 0, label: 'oprit' },
];
const DEFAULT_INTERVAL = 4;

const TRIGGER_LABEL: Record<string, string> = {
  submission: 'trimitere',
  manual: 'manual',
  scheduled: 'programat',
};

interface FormStatus {
  key: SheetsForm;
  label: string;
  spreadsheetId: string | null;
  spreadsheetName: string | null;
  tab: string | null;
  partitioned?: boolean;
  partitionField?: string | null;
  fallbackTab?: string | null;
  enabled?: boolean;
  intervalHours?: number | null;
  lastSyncAt?: string | null;
  lastSyncOk?: boolean | null;
  lastSyncMessage?: string | null;
  lastReconcileAt?: string | null;
  rowCountDb?: number | null;
}

interface StatusPayload {
  credentials: 'ok' | 'missing';
  serviceAccountEmail: string | null;
  dryRun?: boolean;
  intervalHours?: number | null;
  lastReconcileAt?: string | null;
  forms: FormStatus[];
}

interface HistoryRow {
  trigger: string;
  added: number;
  updated: number;
  removed: number;
  ok: boolean;
  message: string | null;
  at: string | null;
}

type VerifyState =
  | { kind: 'ok'; spreadsheetId: string; spreadsheetName: string }
  | { kind: 'no_access'; message: string }
  | { kind: 'invalid'; message: string }
  | { kind: 'not_configured'; message: string }
  | { kind: 'failed'; message: string };

const RO_MON = ['ian', 'feb', 'mar', 'apr', 'mai', 'iun', 'iul', 'aug', 'sep', 'oct', 'noi', 'dec'];
const pad2 = (n: number) => String(n).padStart(2, '0');

/** "azi 16:00" / "ieri 23:14" / "14 sep 08:00". Empty string for a missing date. */
function fmtWhen(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  const time = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  const today = new Date();
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (sameDay(d, today)) return `azi ${time}`;
  const yesterday = new Date(today.getTime() - 86400000);
  if (sameDay(d, yesterday)) return `ieri ${time}`;
  return `${d.getDate()} ${RO_MON[d.getMonth()]} ${time}`;
}

/** Romanian numeral rule: "2 rânduri", but "47 de rânduri" from 20 up. */
function plural(n: number, word: string): string {
  const mod = n % 100;
  const needsDe = n >= 20 && !(mod >= 1 && mod <= 19);
  return `${n} ${needsDe ? 'de ' : ''}${word}`;
}

/** Counts as a Romanian phrase: "2 adăugate, 1 modificată". */
function countsText(added: number, updated: number, removed: number): string {
  const parts: string[] = [];
  if (added) parts.push(`${added} ${added === 1 ? 'adăugat' : 'adăugate'}`);
  if (updated) parts.push(`${updated} ${updated === 1 ? 'modificat' : 'modificate'}`);
  if (removed) parts.push(`${removed} ${removed === 1 ? 'șters' : 'șterse'}`);
  return parts.length ? parts.join(', ') : 'fără diferențe';
}

// Dialog-local styles, tokens only (var(--theme-*), var(--ui-*)). Kept free of
// backticks on purpose: one stray backtick in a template literal takes the
// whole admin panel down to a blank page.
const SHEETS_CSS = `
.ui-root .sdlg-sub{margin:0 0 12px;font-size:var(--ui-fs-body-sm);color:var(--theme-text-muted)}
.ui-root .sdlg-stack{display:flex;flex-direction:column;gap:12px}
.ui-root .sdlg-row{display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap}
.ui-root .sdlg-row .ui-field{flex:1;min-width:200px}
.ui-root .sdlg-grow{flex:1}
.ui-root .sdlg-cap{font-size:11px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:var(--theme-text-muted);margin:0 0 8px}
.ui-root .sdlg-sched{display:flex;gap:12px;align-items:center;flex-wrap:wrap}
.ui-root .sdlg-sched .ui-input{width:auto;min-width:168px}
.ui-root .sdlg-last{font-size:12px;color:var(--theme-text-muted)}
.ui-root .sdlg-last b{color:var(--theme-text);font-weight:600}
.ui-root .sdlg-mono{font-family:var(--ui-font-mono);font-size:11.5px;color:var(--theme-text);background:var(--theme-surface-sunken);border:1px solid var(--theme-border);border-radius:var(--ui-radius-sm);padding:3px 7px;white-space:nowrap;overflow-x:auto}
.ui-root .sdlg-addr{display:flex;align-items:center;gap:9px;margin-top:6px;min-width:0}
.ui-root .sdlg-addr .sdlg-mono{flex:1;min-width:0}
.ui-root .sdlg-link{font-family:inherit;font-size:11.5px;font-weight:700;color:var(--theme-primary);background:none;border:none;cursor:pointer;padding:0;white-space:nowrap}
.ui-root .sdlg-link:hover{text-decoration:underline}
.ui-root .sdlg-divider{display:flex;align-items:center;gap:10px;color:var(--theme-text-muted);font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase}
.ui-root .sdlg-divider::before,.ui-root .sdlg-divider::after{content:"";height:1px;background:var(--theme-border);flex:1}
.ui-root .sdlg-hist{border:1px solid var(--theme-border);border-radius:var(--ui-radius-sm);overflow:hidden;margin-top:6px}
.ui-root .sdlg-hist .ui-table{font-size:11.5px}
.ui-root .sdlg-hist .ui-table th{padding:6px 10px;background:var(--theme-surface-subtle)}
.ui-root .sdlg-hist .ui-table td{padding:6px 10px;color:var(--theme-text-secondary);font-variant-numeric:tabular-nums}
.ui-root .sdlg-hist .ui-table tr:last-child td{border-bottom:none}
.ui-root .sdlg-hist .sdlg-t{color:var(--theme-text-muted)}
.ui-root .sdlg-hist .sdlg-good{color:var(--theme-success);font-weight:700}
.ui-root .sdlg-hist .sdlg-bad{color:var(--theme-danger);font-weight:700}
.ui-root .sdlg-hist .sdlg-none{padding:12px 10px;color:var(--theme-text-muted);font-size:12px}
`;

/** Address of the robot account with a copy control, used in two places. */
function ServiceAccountAddress({ email }: { email: string }) {
  const [copied, setCopied] = React.useState(false);
  const copy = () => {
    const done = () => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(email).then(done, () => undefined);
    } else {
      done();
    }
  };
  return (
    <div className="sdlg-addr">
      <span className="sdlg-mono">{email}</span>
      <button type="button" className="sdlg-link" onClick={copy}>
        {copied ? 'copiat' : 'copiază'}
      </button>
    </div>
  );
}

export interface SheetsDialogProps {
  open: boolean;
  /** Which form this window configures. */
  form: SheetsForm;
  /** Screen name shown in the header, e.g. 'Înscrieri'. */
  label: string;
  onClose: () => void;
  /** Called after any change that alters the connection state. */
  onChanged?: () => void;
}

export function SheetsDialog({ open, form, label, onClose, onChanged }: SheetsDialogProps) {
  const { get, post } = useFetchClient();

  const [loading, setLoading] = React.useState(true);
  const [status, setStatus] = React.useState<StatusPayload | null>(null);
  const [entry, setEntry] = React.useState<FormStatus | null>(null);
  const [history, setHistory] = React.useState<HistoryRow[]>([]);
  const [busy, setBusy] = React.useState(false);
  /** A failed status load: persistent, shown in the dialog. */
  const [loadErr, setLoadErr] = React.useState<string | null>(null);

  // connect pane
  const [editing, setEditing] = React.useState(false);
  const [link, setLink] = React.useState('');
  const [verify, setVerify] = React.useState<VerifyState | null>(null);

  // schedule
  const [interval, setIntervalValue] = React.useState<number>(DEFAULT_INTERVAL);
  const [confirmDisconnect, setConfirmDisconnect] = React.useState(false);

  const connected = Boolean(entry?.spreadsheetId);
  const saEmail = status?.serviceAccountEmail ?? '';

  const load = React.useCallback(async () => {
    setLoadErr(null);
    try {
      const r: any = await get(`${SHEETS_API}/status`);
      const payload: StatusPayload = r?.data ?? { credentials: 'missing', serviceAccountEmail: null, forms: [] };
      setStatus(payload);
      const mine = (payload.forms ?? []).find((f) => f.key === form) ?? null;
      setEntry(mine);
      const iv = mine?.intervalHours ?? payload.intervalHours;
      setIntervalValue(typeof iv === 'number' ? iv : DEFAULT_INTERVAL);
      if (mine?.spreadsheetId) {
        try {
          const h: any = await get(`${SHEETS_API}/${form}/history`, { params: { limit: 20 } });
          setHistory(Array.isArray(h?.data?.history) ? h.data.history.slice(0, 20) : []);
        } catch {
          setHistory([]);
        }
      } else {
        setHistory([]);
      }
    } catch {
      setLoadErr('Nu am putut citi starea conexiunii cu Google Sheets.');
    } finally {
      setLoading(false);
    }
  }, [get, form]);

  React.useEffect(() => {
    if (!open) return;
    setLoading(true);
    setEditing(false);
    setLink('');
    setVerify(null);
    setLoadErr(null);
    load();
  }, [open, load]);

  const sheetUrl = entry?.spreadsheetId
    ? `https://docs.google.com/spreadsheets/d/${entry.spreadsheetId}/edit`
    : null;

  // --- actions

  const runVerify = React.useCallback(async () => {
    const value = link.trim();
    if (!value) return;
    setBusy(true);
    setVerify(null);
    try {
      // The controller reads `link`; `spreadsheetId` is sent too so a bare id
      // works whichever key the server prefers.
      const r: any = await post(`${SHEETS_API}/${form}/verify`, { link: value, spreadsheetId: value });
      const res = r?.data ?? {};
      if (res.ok) {
        setVerify({ kind: 'ok', spreadsheetId: res.spreadsheetId, spreadsheetName: res.spreadsheetName ?? '' });
      } else if (res.reason === 'no_access') {
        setVerify({ kind: 'no_access', message: res.message ?? '' });
      } else if (res.reason === 'invalid_link' || res.reason === 'not_found') {
        setVerify({
          kind: 'invalid',
          message:
            res.reason === 'not_found'
              ? 'Nu există nicio foaie cu acest ID.'
              : 'Link invalid. Copiază adresa din bara browserului, cu foaia deschisă.',
        });
      } else if (res.reason === 'not_configured' || res.reason === 'client_unavailable') {
        setVerify({ kind: 'not_configured', message: res.message ?? '' });
      } else {
        setVerify({ kind: 'failed', message: res.message ?? 'Verificarea a eșuat.' });
      }
    } catch {
      setVerify({ kind: 'failed', message: 'Verificarea a eșuat. Serverul nu a răspuns.' });
    } finally {
      setBusy(false);
    }
  }, [post, form, link]);

  const runConnect = React.useCallback(async () => {
    if (verify?.kind !== 'ok') return;
    setBusy(true);
    try {
      const r: any = await post(`${SHEETS_API}/${form}/connect`, {
        spreadsheetId: verify.spreadsheetId,
        spreadsheetName: verify.spreadsheetName,
      });
      if (r?.data?.ok === false) {
        adminToast.error(r.data.message ?? 'Conectarea a eșuat.');
        return;
      }
      setEditing(false);
      setLink('');
      setVerify(null);
      adminToast.success('Foaia a fost conectată.');
      await load();
      onChanged?.();
    } catch {
      adminToast.error('Conectarea a eșuat.');
    } finally {
      setBusy(false);
    }
  }, [post, form, verify, load, onChanged]);

  const runCreate = React.useCallback(async () => {
    setBusy(true);
    setVerify(null);
    try {
      const r: any = await post(`${SHEETS_API}/${form}/create`, {});
      const res = r?.data ?? {};
      if (!res.ok) {
        adminToast.error(res.message ?? 'Nu am putut crea foaia de calcul.');
        return;
      }
      setEditing(false);
      setLink('');
      if (res.sharedWith) adminToast.success(`Foaie nouă creată și partajată cu ${res.sharedWith}.`);
      else adminToast.warning('Foaie nouă creată. Nu am putut-o partaja automat, deschide-o din link.');
      await load();
      onChanged?.();
    } catch {
      adminToast.error('Nu am putut crea foaia de calcul.');
    } finally {
      setBusy(false);
    }
  }, [post, form, load, onChanged]);

  const runSync = React.useCallback(async () => {
    setBusy(true);
    try {
      const r: any = await post(`${SHEETS_API}/${form}/sync`, { mode: 'full' });
      const res = r?.data ?? {};
      if (res.ok) {
        adminToast.success(`Sincronizare completă: ${countsText(res.added ?? 0, res.updated ?? 0, res.removed ?? 0)}.`);
      } else {
        adminToast.error(res.message ?? 'Sincronizarea a eșuat.');
      }
      await load();
      onChanged?.();
    } catch {
      adminToast.error('Sincronizarea a eșuat.');
    } finally {
      setBusy(false);
    }
  }, [post, form, load, onChanged]);

  const runDisconnect = React.useCallback(async () => {
    setBusy(true);
    try {
      await post(`${SHEETS_API}/${form}/disconnect`, {});
      setConfirmDisconnect(false);
      adminToast.success('Foaia a fost deconectată. Datele din foaie rămân neatinse.');
      await load();
      onChanged?.();
    } catch {
      adminToast.error('Deconectarea a eșuat.');
    } finally {
      setBusy(false);
    }
  }, [post, form, load, onChanged]);

  const changeInterval = React.useCallback(
    async (value: number) => {
      const previous = interval;
      setIntervalValue(value);
      try {
        const r: any = await post(`${SHEETS_API}/${form}/schedule`, { intervalHours: value });
        if (r?.data?.ok === false) {
          setIntervalValue(previous);
          adminToast.error(r.data.message ?? 'Nu am putut salva ritmul verificării.');
        } else {
          toastAutosaved();
        }
      } catch (e: any) {
        setIntervalValue(previous);
        const code = e?.response?.status ?? e?.status;
        adminToast.error(
          code === 404
            ? 'Ritmul verificării nu poate fi salvat încă: serverul nu are endpointul de programare.'
            : 'Nu am putut salva ritmul verificării.',
        );
      }
    },
    [post, form, interval],
  );

  if (!open) return null;

  const tabText = entry?.partitioned
    ? `câte o filă pe ${entry.partitionField ?? 'sezon'}`
    : `fila ${entry?.tab || 'Date'}`;

  const lastReconcile = entry?.lastReconcileAt ?? status?.lastReconcileAt ?? null;

  const credentialsMissing = status?.credentials === 'missing';

  const notConfigured = (
    <Notice tone="warning" title="Google Sheets nu este configurat pe server.">
      Lipsesc cheile contului de serviciu: <span className="sdlg-mono">GOOGLE_SA_EMAIL</span>,{' '}
      <span className="sdlg-mono">GOOGLE_SA_PRIVATE_KEY</span>.
    </Notice>
  );

  const connectBody = (
    <div className="sdlg-stack">
      {credentialsMissing && notConfigured}
      <div>
        <div className="sdlg-row">
          <Field label="Link către foaie">
            <Input
              placeholder="https://docs.google.com/spreadsheets/d/"
              value={link}
              onChange={(e) => {
                setLink(e.target.value);
                setVerify(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') runVerify();
              }}
            />
          </Field>
          <Button variant="secondary" onClick={runVerify} disabled={busy || !link.trim()}>
            Verifică
          </Button>
        </div>
        {saEmail && (
          <>
            <div className="ui-hint" style={{ marginTop: 4 }}>
              Foaia trebuie partajată cu drepturi de <b>editor</b> către adresa contului de serviciu (generată de Google
              la crearea contului):
            </div>
            <ServiceAccountAddress email={saEmail} />
          </>
        )}
      </div>

      {verify?.kind === 'ok' && (
        <Notice tone="success" title={<>Conectat la „{verify.spreadsheetName}"</>}>
          {tabText}, {plural(entry?.rowCountDb ?? 0, 'rânduri')} în baza de date
        </Notice>
      )}
      {verify?.kind === 'no_access' && (
        <Notice tone="danger" title="Foaia există, dar contul de serviciu nu are acces.">
          Partajeaz-o cu drepturi de <b>editor</b> către:
          {saEmail ? <ServiceAccountAddress email={saEmail} /> : <> {verify.message}</>}
        </Notice>
      )}
      {verify?.kind === 'invalid' && <Notice tone="danger">{verify.message}</Notice>}
      {verify?.kind === 'not_configured' && notConfigured}
      {verify?.kind === 'failed' && <Notice tone="danger">{verify.message}</Notice>}

      <div className="sdlg-divider">sau</div>
      <Notice tone="info" title="Foaie nouă">
        Creată de contul de serviciu și partajată cu adresa ta, ca să apară în Google Drive.
      </Notice>
    </div>
  );

  const connectFooter = (
    <>
      <Button variant="secondary" onClick={runCreate} disabled={busy || credentialsMissing}>
        Creează foaie nouă
      </Button>
      <span className="sdlg-grow" />
      <Button
        variant="secondary"
        onClick={() => {
          if (connected) {
            setEditing(false);
            setVerify(null);
            setLink('');
          } else {
            onClose();
          }
        }}
        disabled={busy}
      >
        Anulează
      </Button>
      <Button onClick={runConnect} disabled={busy || verify?.kind !== 'ok'}>
        Conectează
      </Button>
    </>
  );

  const connectedBody = (
    <div className="sdlg-stack">
      <Notice
        tone="success"
        title={
          <>
            {entry?.spreadsheetName || 'Foaie conectată'}, {tabText}
          </>
        }
        action={
          sheetUrl ? (
            <a className="sdlg-link" href={sheetUrl} target="_blank" rel="noopener noreferrer">
              Deschide Google Sheet
            </a>
          ) : undefined
        }
      >
        {entry?.lastSyncAt
          ? `Ultima sincronizare ${fmtWhen(entry.lastSyncAt)}${entry.lastSyncMessage ? `: ${entry.lastSyncMessage}` : ''}`
          : 'Nicio sincronizare încă.'}
      </Notice>

      <div className="sdlg-row">
        <Button onClick={runSync} disabled={busy}>
          Sincronizează acum
        </Button>
        <Button variant="secondary" onClick={() => setEditing(true)} disabled={busy}>
          Schimbă foaia
        </Button>
        <span className="sdlg-grow" />
        <Button variant="danger" onClick={() => setConfirmDisconnect(true)} disabled={busy}>
          Deconectează
        </Button>
      </div>

      <div>
        <p className="sdlg-cap">Verificare automată</p>
        <div className="sdlg-sched" style={{ marginBottom: 6 }}>
          <Select
            aria-label="Ritmul verificării automate"
            value={String(interval)}
            onChange={(v) => changeInterval(Number(v))}
            disabled={busy}
            options={INTERVALS.map((o) => ({ value: String(o.value), label: o.label }))}
          />
          <span className="sdlg-last">
            {lastReconcile ? (
              <>
                Ultima verificare <b>{fmtWhen(lastReconcile)}</b>
              </>
            ) : (
              'Nicio verificare automată încă'
            )}
          </span>
        </div>
        <div className="ui-hint">
          Trimiterile ajung în foaie imediat. Verificarea compară foaia cu baza de date și repară ce a lipsit, dacă
          Google a fost indisponibil.
          {interval === 0 && ' „Oprit" oprește doar verificarea periodică, nu și trimiterile către foaie.'}
        </div>
      </div>

      <div>
        <p className="sdlg-cap" style={{ marginBottom: 0 }}>
          Istoric, ultimele 20
        </p>
        <div className="sdlg-hist">
          {history.length === 0 ? (
            <div className="sdlg-none">Nicio rulare înregistrată încă.</div>
          ) : (
            <div className="ui-table-wrap">
              <table className="ui-table">
                <thead>
                  <tr>
                    <th>Când</th>
                    <th>Pornit de</th>
                    <th>Adăugate</th>
                    <th>Modificate</th>
                    <th>Șterse</th>
                    <th>Rezultat</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h, i) => (
                    <tr key={`${h.at ?? 'x'}-${i}`}>
                      <td className="sdlg-t">{fmtWhen(h.at)}</td>
                      <td>{TRIGGER_LABEL[h.trigger] ?? h.trigger}</td>
                      <td>{h.added || ''}</td>
                      <td>{h.updated || ''}</td>
                      <td>{h.removed || ''}</td>
                      <td className={h.ok ? 'sdlg-good' : 'sdlg-bad'}>{h.message || (h.ok ? 'ok' : 'eroare')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="ui-hint" style={{ marginTop: 4 }}>
          Se păstrează ultimele 20 de rulări per formular.
        </div>
      </div>
    </div>
  );

  const connectedFooter = (
    <Button variant="secondary" onClick={onClose} disabled={busy}>
      Închide
    </Button>
  );

  const showConnected = !loading && connected && !editing;

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        dismissable={!busy}
        size="md"
        title={`Google Sheets: ${label}`}
        footer={loading ? undefined : showConnected ? connectedFooter : connectFooter}
      >
        <style>{SHEETS_CSS}</style>
        <p className="sdlg-sub">
          {connected ? 'Conectat, cu sincronizare la fiecare trimitere' : 'Trimiterile sunt scrise automat într-o foaie de calcul.'}
        </p>
        {loadErr && (
          <div style={{ marginBottom: 12 }}>
            <Notice tone="danger">{loadErr}</Notice>
          </div>
        )}
        {loading ? <Loading /> : showConnected ? connectedBody : connectBody}
      </Modal>

      <ConfirmDialog
        open={confirmDisconnect}
        title="Deconectezi foaia?"
        message={`Nu mai trimitem nimic către „${entry?.spreadsheetName || 'foaia conectată'}". Foaia și datele din ea rămân neatinse.`}
        confirmLabel="Deconectează"
        busyLabel="Se deconectează..."
        busy={busy}
        onCancel={() => setConfirmDisconnect(false)}
        onConfirm={runDisconnect}
      />
    </>
  );
}

export default SheetsDialog;
