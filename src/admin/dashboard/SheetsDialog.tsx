import * as React from 'react';
import { useFetchClient } from '@strapi/admin/strapi-admin';
import { ConfirmDialog } from '../ConfirmDialog';

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
 * Self-contained styling under `.sdlg`, mirroring the shared admin tokens
 * (system-ui, #fff chrome, #dcdcdc borders, accent #2138b8, danger #be3330,
 * #d0d0d0 fields, 4px radius). No backticks inside the CSS literal.
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

const CSS = `
.sdlg-scrim{position:fixed;inset:0;background:rgba(0,0,0,.35);z-index:390;display:flex;align-items:flex-start;justify-content:center;padding:32px 16px;overflow-y:auto}
.sdlg{width:560px;max-width:100%;background:#fff;border:1px solid #dcdcdc;border-radius:6px;overflow:hidden;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#1b1d22;font-size:13px;line-height:1.5;box-shadow:0 16px 48px rgba(0,0,0,.24)}
.sdlg *{box-sizing:border-box}
.sdlg .mh{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;padding:14px 16px;border-bottom:1px solid #e0e2e8}
.sdlg .mh h3{margin:0;font-size:15.5px;font-weight:800}
.sdlg .mh p{margin:3px 0 0;font-size:12px;color:#727888}
.sdlg .mh .x{border:none;background:none;color:#9aa0ae;font-size:17px;line-height:1;cursor:pointer;padding:0 2px}
.sdlg .mb{padding:15px 16px}
.sdlg .mf{display:flex;align-items:center;gap:9px;padding:12px 16px;border-top:1px solid #e0e2e8;background:#fbfbfc}
.sdlg .grow{flex:1}
.sdlg .btn{font-family:inherit;font-size:12.5px;font-weight:600;padding:7px 12px;border-radius:4px;border:1px solid #d0d0d0;background:#fff;color:#1b1d22;cursor:pointer;white-space:nowrap}
.sdlg .btn:hover:not(:disabled){border-color:#b6bac4;background:#fafbff}
.sdlg .btn.pri{background:#2138b8;border-color:#2138b8;color:#fff}
.sdlg .btn.pri:hover:not(:disabled){background:#1b2fa0}
.sdlg .btn.danger{color:#be3330;border-color:#e2c4c4;background:#fff}
.sdlg .btn.danger:hover:not(:disabled){background:#fdf4f3}
.sdlg .btn:disabled{opacity:.55;cursor:default}
.sdlg .fld{margin-bottom:12px}
.sdlg .fld label{display:block;font-size:10px;color:#727888;margin-bottom:4px;text-transform:uppercase;letter-spacing:.05em;font-weight:700}
.sdlg input[type=text]{display:block;width:100%;font-family:inherit;border:1px solid #d0d0d0;border-radius:4px;padding:7px 9px;font-size:12.5px;min-height:32px;color:#1b1d22;background:#fff}
.sdlg input[type=text]:focus{outline:none;border-color:#2138b8}
.sdlg select{font-family:inherit;font-size:12.5px;color:#1b1d22;background:#fff;border:1px solid #d0d0d0;border-radius:4px;padding:7px 10px;min-width:168px}
.sdlg select:focus{outline:none;border-color:#2138b8}
.sdlg .row{display:flex;gap:8px;align-items:flex-end}
.sdlg .row .fld{flex:1;margin-bottom:0}
.sdlg .hint{font-size:11px;color:#727888;margin-top:4px}
.sdlg .cap{font-size:11px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:#727888;margin:0 0 8px}
.sdlg .sched{display:flex;gap:12px;align-items:center;flex-wrap:wrap}
.sdlg .sched .last{font-size:12px;color:#727888}
.sdlg .sched .last b{color:#1b1d22;font-weight:600}
.sdlg .ok-box{background:#e7f3ec;border:1px solid #bfe0cc;border-radius:4px;padding:10px 11px;font-size:12.5px;color:#1f5c3d}
.sdlg .err-box{background:#faeceb;border:1px solid #e6c3c1;border-radius:4px;padding:10px 11px;font-size:12.5px;color:#8c2b28}
.sdlg .info-box{background:#f6f7f9;border:1px solid #e0e2e8;border-radius:4px;padding:10px 11px;font-size:12.5px;color:#3b4050}
.sdlg .warn-box{background:#fbf1df;border:1px solid #ecd9ac;border-radius:4px;padding:10px 11px;font-size:12.5px;color:#7a4f00}
.sdlg .mono{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11.5px;background:#f2f3f7;border:1px solid #e0e2e8;border-radius:3px;padding:3px 7px;white-space:nowrap;overflow-x:auto}
.sdlg .addr{display:flex;align-items:center;gap:9px;margin-top:6px;min-width:0}
.sdlg .addr .mono{flex:1;min-width:0}
.sdlg .copy{font-family:inherit;font-size:11px;font-weight:700;color:#2138b8;background:none;border:none;cursor:pointer;white-space:nowrap;padding:0}
.sdlg .link{font-family:inherit;font-size:11.5px;font-weight:700;color:#2138b8;background:none;border:none;cursor:pointer;padding:0}
.sdlg .divider{display:flex;align-items:center;gap:10px;margin:14px 0;color:#a3a6b2;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase}
.sdlg .divider::before,.sdlg .divider::after{content:"";height:1px;background:#e0e2e8;flex:1}
.sdlg .hist{border:1px solid #e0e2e8;border-radius:4px;overflow:hidden;margin-top:6px}
.sdlg .hist table{width:100%;border-collapse:collapse;font-size:11.5px}
.sdlg .hist th{text-align:left;font-size:9.5px;letter-spacing:.05em;text-transform:uppercase;color:#8a8d99;font-weight:700;padding:6px 10px;background:#fafbfc;border-bottom:1px solid #e0e2e8}
.sdlg .hist td{padding:6px 10px;border-bottom:1px solid #f2f3f6;color:#3b4050;font-variant-numeric:tabular-nums}
.sdlg .hist tr:last-child td{border-bottom:none}
.sdlg .hist .t{color:#727888}
.sdlg .hist .good{color:#1f7a4d;font-weight:700}
.sdlg .hist .bad{color:#be3330;font-weight:700}
.sdlg .hist .zero{color:#b6b9c4}
.sdlg .hist .none{padding:12px 10px;color:#727888;font-size:12px}
.sdlg .loading{padding:28px 10px;text-align:center;color:#727888;font-size:12.5px}
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
    <div className="addr">
      <span className="mono">{email}</span>
      <button type="button" className="copy" onClick={copy}>
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
  const [err, setErr] = React.useState<string | null>(null);
  const [note, setNote] = React.useState<string | null>(null);

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
    setErr(null);
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
      setErr('Nu am putut citi starea conexiunii cu Google Sheets.');
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
    setErr(null);
    setNote(null);
    load();
  }, [open, load]);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy && !confirmDisconnect) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, busy, confirmDisconnect, onClose]);

  const sheetUrl = entry?.spreadsheetId
    ? `https://docs.google.com/spreadsheets/d/${entry.spreadsheetId}/edit`
    : null;

  // --- actions

  const runVerify = React.useCallback(async () => {
    const value = link.trim();
    if (!value) return;
    setBusy(true);
    setVerify(null);
    setErr(null);
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
    setErr(null);
    try {
      const r: any = await post(`${SHEETS_API}/${form}/connect`, {
        spreadsheetId: verify.spreadsheetId,
        spreadsheetName: verify.spreadsheetName,
      });
      if (r?.data?.ok === false) {
        setErr(r.data.message ?? 'Conectarea a eșuat.');
        return;
      }
      setEditing(false);
      setLink('');
      setVerify(null);
      setNote('Foaia a fost conectată.');
      await load();
      onChanged?.();
    } catch {
      setErr('Conectarea a eșuat.');
    } finally {
      setBusy(false);
    }
  }, [post, form, verify, load, onChanged]);

  const runCreate = React.useCallback(async () => {
    setBusy(true);
    setErr(null);
    setVerify(null);
    try {
      const r: any = await post(`${SHEETS_API}/${form}/create`, {});
      const res = r?.data ?? {};
      if (!res.ok) {
        setErr(res.message ?? 'Nu am putut crea foaia de calcul.');
        return;
      }
      setEditing(false);
      setLink('');
      setNote(
        res.sharedWith
          ? `Foaie nouă creată și partajată cu ${res.sharedWith}.`
          : 'Foaie nouă creată. Nu am putut-o partaja automat, deschide-o din link.',
      );
      await load();
      onChanged?.();
    } catch {
      setErr('Nu am putut crea foaia de calcul.');
    } finally {
      setBusy(false);
    }
  }, [post, form, load, onChanged]);

  const runSync = React.useCallback(async () => {
    setBusy(true);
    setErr(null);
    setNote(null);
    try {
      const r: any = await post(`${SHEETS_API}/${form}/sync`, { mode: 'full' });
      const res = r?.data ?? {};
      if (res.ok) {
        setNote(`Sincronizare completă: ${countsText(res.added ?? 0, res.updated ?? 0, res.removed ?? 0)}.`);
      } else {
        setErr(res.message ?? 'Sincronizarea a eșuat.');
      }
      await load();
      onChanged?.();
    } catch {
      setErr('Sincronizarea a eșuat.');
    } finally {
      setBusy(false);
    }
  }, [post, form, load, onChanged]);

  const runDisconnect = React.useCallback(async () => {
    setBusy(true);
    setErr(null);
    try {
      await post(`${SHEETS_API}/${form}/disconnect`, {});
      setConfirmDisconnect(false);
      setNote('Foaia a fost deconectată. Datele din foaie rămân neatinse.');
      await load();
      onChanged?.();
    } catch {
      setErr('Deconectarea a eșuat.');
    } finally {
      setBusy(false);
    }
  }, [post, form, load, onChanged]);

  const changeInterval = React.useCallback(
    async (value: number) => {
      const previous = interval;
      setIntervalValue(value);
      setErr(null);
      setNote(null);
      try {
        const r: any = await post(`${SHEETS_API}/${form}/schedule`, { intervalHours: value });
        if (r?.data?.ok === false) {
          setIntervalValue(previous);
          setErr(r.data.message ?? 'Nu am putut salva ritmul verificării.');
        }
      } catch (e: any) {
        setIntervalValue(previous);
        const code = e?.response?.status ?? e?.status;
        setErr(
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

  const header = (
    <div className="mh">
      <div>
        <h3>Google Sheets: {label}</h3>
        <p>
          {connected
            ? 'Conectat, cu sincronizare la fiecare trimitere'
            : 'Trimiterile sunt scrise automat într-o foaie de calcul.'}
        </p>
      </div>
      <button type="button" className="x" aria-label="Închide" onClick={onClose} disabled={busy}>
        ✕
      </button>
    </div>
  );

  const messages = (
    <>
      {err && (
        <div className="err-box" style={{ marginBottom: 12 }}>
          {err}
        </div>
      )}
      {note && !err && (
        <div className="ok-box" style={{ marginBottom: 12 }}>
          {note}
        </div>
      )}
    </>
  );

  const connectPane = (
    <>
      <div className="mb">
        {messages}
        {credentialsMissing && (
          <div className="warn-box" style={{ marginBottom: 12 }}>
            <b>Google Sheets nu este configurat pe server.</b>
            <br />
            Lipsesc cheile contului de serviciu: <span className="mono">GOOGLE_SA_EMAIL</span>,{' '}
            <span className="mono">GOOGLE_SA_PRIVATE_KEY</span>.
          </div>
        )}
        <div className="fld">
          <label htmlFor="sdlg-link">Link către foaie</label>
          <div className="row">
            <div className="fld">
              <input
                id="sdlg-link"
                type="text"
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
            </div>
            <button type="button" className="btn" onClick={runVerify} disabled={busy || !link.trim()}>
              Verifică
            </button>
          </div>
          {saEmail && (
            <>
              <div className="hint">
                Foaia trebuie partajată cu drepturi de <b>editor</b> către adresa contului de serviciu (generată de
                Google la crearea contului):
              </div>
              <ServiceAccountAddress email={saEmail} />
            </>
          )}
        </div>

        {verify?.kind === 'ok' && (
          <div className="ok-box">
            Conectat la <b>„{verify.spreadsheetName}"</b>
            <br />
            {tabText}, {plural(entry?.rowCountDb ?? 0, 'rânduri')} în baza de date
          </div>
        )}
        {verify?.kind === 'no_access' && (
          <div className="err-box">
            Foaia există, dar contul de serviciu nu are acces.
            <br />
            Partajeaz-o cu drepturi de <b>editor</b> către:
            {saEmail ? <ServiceAccountAddress email={saEmail} /> : <> {verify.message}</>}
          </div>
        )}
        {verify?.kind === 'invalid' && <div className="err-box">{verify.message}</div>}
        {verify?.kind === 'not_configured' && (
          <div className="warn-box">
            <b>Google Sheets nu este configurat pe server.</b>
            <br />
            Lipsesc cheile contului de serviciu: <span className="mono">GOOGLE_SA_EMAIL</span>,{' '}
            <span className="mono">GOOGLE_SA_PRIVATE_KEY</span>.
          </div>
        )}
        {verify?.kind === 'failed' && <div className="err-box">{verify.message}</div>}

        <div className="divider">sau</div>
        <div className="info-box">
          <b>Foaie nouă</b>
          <br />
          Creată de contul de serviciu și partajată cu adresa ta, ca să apară în Google Drive.
        </div>
      </div>
      <div className="mf">
        <button type="button" className="btn" onClick={runCreate} disabled={busy || credentialsMissing}>
          Creează foaie nouă
        </button>
        <span className="grow" />
        <button
          type="button"
          className="btn"
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
        </button>
        <button type="button" className="btn pri" onClick={runConnect} disabled={busy || verify?.kind !== 'ok'}>
          Conectează
        </button>
      </div>
    </>
  );

  const connectedPane = (
    <>
      <div className="mb">
        {messages}
        <div className="ok-box" style={{ marginBottom: 13 }}>
          <b>{entry?.spreadsheetName || 'Foaie conectată'}</b>, {tabText}{' '}
          {sheetUrl && (
            <a className="copy" href={sheetUrl} target="_blank" rel="noopener noreferrer">
              Deschide Google Sheet
            </a>
          )}
          <br />
          {entry?.lastSyncAt
            ? `Ultima sincronizare ${fmtWhen(entry.lastSyncAt)}${
                entry.lastSyncMessage ? `: ${entry.lastSyncMessage}` : ''
              }`
            : 'Nicio sincronizare încă.'}
        </div>

        <div className="row" style={{ marginBottom: 14 }}>
          <button type="button" className="btn pri" onClick={runSync} disabled={busy}>
            Sincronizează acum
          </button>
          <button type="button" className="btn" onClick={() => setEditing(true)} disabled={busy}>
            Schimbă foaia
          </button>
          <span className="grow" />
          <button type="button" className="btn danger" onClick={() => setConfirmDisconnect(true)} disabled={busy}>
            Deconectează
          </button>
        </div>

        <p className="cap">Verificare automată</p>
        <div className="sched" style={{ marginBottom: 6 }}>
          <select
            aria-label="Ritmul verificării automate"
            value={String(interval)}
            onChange={(e) => changeInterval(Number(e.target.value))}
            disabled={busy}
          >
            {INTERVALS.map((o) => (
              <option key={o.value} value={String(o.value)}>
                {o.label}
              </option>
            ))}
          </select>
          <span className="last">
            {lastReconcile ? (
              <>
                Ultima verificare <b>{fmtWhen(lastReconcile)}</b>
              </>
            ) : (
              'Nicio verificare automată încă'
            )}
          </span>
        </div>
        <div className="hint" style={{ marginBottom: 15 }}>
          Trimiterile ajung în foaie imediat. Verificarea compară foaia cu baza de date și repară ce a lipsit, dacă
          Google a fost indisponibil.
          {interval === 0 && ' „Oprit" oprește doar verificarea periodică, nu și trimiterile către foaie.'}
        </div>

        <p className="cap" style={{ marginBottom: 0 }}>
          Istoric, ultimele 20
        </p>
        <div className="hist">
          {history.length === 0 ? (
            <div className="none">Nicio rulare înregistrată încă.</div>
          ) : (
            <table>
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
                    <td className="t">{fmtWhen(h.at)}</td>
                    <td>{TRIGGER_LABEL[h.trigger] ?? h.trigger}</td>
                    <td className={h.added ? undefined : 'zero'}>{h.added || ''}</td>
                    <td className={h.updated ? undefined : 'zero'}>{h.updated || ''}</td>
                    <td className={h.removed ? undefined : 'zero'}>{h.removed || ''}</td>
                    <td className={h.ok ? 'good' : 'bad'}>{h.message || (h.ok ? 'ok' : 'eroare')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="hint">Se păstrează ultimele 20 de rulări per formular.</div>
      </div>
      <div className="mf">
        <span className="grow" />
        <button type="button" className="btn" onClick={onClose} disabled={busy}>
          Închide
        </button>
      </div>
    </>
  );

  return (
    <>
      <div className="sdlg-scrim" onMouseDown={() => !busy && !confirmDisconnect && onClose()}>
        <div className="sdlg" role="dialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}>
          <style>{CSS}</style>
          {header}
          {loading ? (
            <div className="mb">
              <div className="loading">Se încarcă...</div>
            </div>
          ) : connected && !editing ? (
            connectedPane
          ) : (
            connectPane
          )}
        </div>
      </div>

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
