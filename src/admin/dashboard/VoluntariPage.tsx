import * as React from 'react';
import SubmissionTablePage, {
  fmtDateTime,
  fmtDateShort,
  type ColumnDef,
  type Row,
  type SubmissionTableCfg,
  type TableApi,
} from './SubmissionTable';

/**
 * EduSport admin — "Voluntari" results page.
 *
 * A configuration wrapper around the shared SubmissionTablePage (the machinery
 * extracted from InscrieriPage — see ./SubmissionTable.tsx), so the volunteer
 * screen has full parity with Înscrieri: quick search, the generic filter
 * builder, Compact list + detail panel, the "Toate coloanele" spreadsheet with
 * per-user column show/hide + drag reorder, inline status editing, internal
 * note, per-row delete, CSV export and the Google Sheets connection. Seasons /
 * archived view / bulk actions stay registration-only and are disabled here.
 *
 * Endpoints (admin-guarded, server-side filtering/sorting/pagination):
 *   GET    /api/forms/voluntari              ?q&status&filters&sort&page&pageSize
 *   PUT    /api/forms/voluntari/:documentId  update editable field
 *   DELETE /api/forms/voluntari/:documentId  permanent delete
 *   GET    /api/forms/voluntari/export.csv   CSV (respects current filters)
 *
 * Google Sheets is a live connection: see SheetsDialog.tsx and /api/sheets/*.
 */

interface VolunteerRow extends Row {
  fullName?: string | null;
  birthDate?: string | null;
  email?: string | null;
  phone?: string | null;
  city?: string | null;
  occupation?: string | null;
  parentName?: string | null;
  parentPhone?: string | null;
  parentalConsent?: boolean | null;
  helpAreas?: unknown;
  availability?: string | null;
  frequency?: string | null;
  skatingExperience?: string | null;
  childrenExperience?: string | null;
  motivation?: string | null;
  howHeard?: string | null;
  privacyConsent?: boolean | null;
}

/** Age in full years from a YYYY-MM-DD (or ISO) birth date; null when unusable. */
function ageOf(birthDate: string | null | undefined): number | null {
  if (!birthDate) return null;
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(birthDate) ? `${birthDate}T00:00:00` : birthDate);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age -= 1;
  return age >= 0 && age < 130 ? age : null;
}

function helpAreasOf(row: VolunteerRow): string[] {
  const raw = row.helpAreas;
  if (Array.isArray(raw)) return raw.map((x) => String(x)).filter((x) => x.trim() !== '');
  return [];
}

/** Birth date + derived age, e.g. "2008-04-12 · 17 ani", with a minor badge. */
function birthDateCell(row: VolunteerRow): React.ReactNode {
  const bd = row.birthDate ?? '';
  if (!bd) return '';
  const age = ageOf(bd);
  return (
    <>
      {bd}
      {age != null ? <span className="num"> · {age} ani</span> : null}
      {age != null && age < 18 ? <span className="minor">minor</span> : null}
    </>
  );
}

function helpAreasText(row: VolunteerRow): React.ReactNode {
  const areas = helpAreasOf(row);
  if (!areas.length) return '';
  return areas.join(', ');
}

// Order convention shared with InscrieriPage: `submittedAt`, the row's name
// column, `status`, then the rest. Bump `colConfigVersion` in CFG whenever this
// order changes so saved per-user orders do not pin the old positions.
// `birthDate` is typed `date` (it holds YYYY-MM-DD): the filter builder then
// forces a date range on it, and its `render` keeps the "· N ani" display.
const BUILTIN_COLUMNS: ColumnDef[] = [
  { key: 'submittedAt', label: 'Trimis la', type: 'date', readOnly: true, width: 150 },
  { key: 'fullName', label: 'Nume', type: 'text', width: 180, render: (r) => <b>{String((r as VolunteerRow).fullName ?? '')}</b> },
  { key: 'status', label: 'Status', type: 'status', width: 130 },
  { key: 'birthDate', label: 'Data nașterii', type: 'date', width: 170, render: (r) => birthDateCell(r as VolunteerRow) },
  { key: 'email', label: 'E-mail', type: 'text', width: 210 },
  { key: 'phone', label: 'Telefon', type: 'text', width: 140 },
  { key: 'city', label: 'Oraș', type: 'text', width: 140 },
  { key: 'occupation', label: 'Ocupație', type: 'text', width: 150 },
  { key: 'helpAreas', label: 'Cum ajută', type: 'list', width: 220, render: (r) => helpAreasText(r as VolunteerRow) },
  { key: 'availability', label: 'Disponibilitate', type: 'text', width: 160 },
  { key: 'frequency', label: 'Frecvență', type: 'text', width: 140 },
  { key: 'skatingExperience', label: 'Patinaj', type: 'text', width: 180 },
  { key: 'childrenExperience', label: 'Experiență copii', type: 'longtext', width: 240 },
  { key: 'motivation', label: 'Motivație', type: 'longtext', width: 240 },
  { key: 'howHeard', label: 'Cum a aflat', type: 'text', width: 160 },
  {
    key: 'parent',
    label: 'Părinte',
    type: 'text',
    width: 200,
    readOnly: true,
    render: (r) => {
      const v = r as VolunteerRow;
      return [v.parentName, v.parentPhone].filter(Boolean).join(' · ');
    },
  },
  { key: 'parentalConsent', label: 'Acord părinți', type: 'bool', width: 120 },
  { key: 'internalNote', label: 'Notă internă', type: 'longtext', width: 240 },
];

// The registry keys that map to removable built-in columns ("(eliminată)"
// handling). status, submittedAt, internalNote and the combined "parent"
// column are meta/derived and are never "removed".
const REGISTRY_COL_KEYS = [
  'fullName',
  'birthDate',
  'email',
  'phone',
  'city',
  'occupation',
  'helpAreas',
  'availability',
  'frequency',
  'skatingExperience',
  'childrenExperience',
  'motivation',
  'howHeard',
  'parentalConsent',
];

// Sensible default-visible subset; everything else starts hidden and can be
// re-enabled from the "Coloane" popover (persisted per user).
const DEFAULT_HIDDEN = [
  'email',
  'phone',
  'occupation',
  'frequency',
  'childrenExperience',
  'motivation',
  'howHeard',
  'parent',
  'parentalConsent',
  'internalNote',
];

// Filter-builder column options (map to whitelisted server fields).
const FILTER_COLUMNS = [
  { key: 'fullName', label: 'Nume' },
  { key: 'birthDate', label: 'Data nașterii' },
  { key: 'email', label: 'E-mail' },
  { key: 'phone', label: 'Telefon' },
  { key: 'city', label: 'Oraș' },
  { key: 'occupation', label: 'Ocupație' },
  { key: 'availability', label: 'Disponibilitate' },
  { key: 'frequency', label: 'Frecvență' },
  { key: 'skatingExperience', label: 'Patinaj' },
  { key: 'howHeard', label: 'Cum a aflat' },
  { key: 'status', label: 'Status' },
  { key: 'submittedAt', label: 'Data trimiterii' },
] as const;

const renderCells = (r: Row, api: TableApi) => {
  const v = r as VolunteerRow;
  const age = ageOf(v.birthDate);
  const areas = helpAreasOf(v);
  return (
    <>
      <td className="sub num">{fmtDateShort(v.submittedAt)}</td>
      <td className="nm">
        {v.fullName ?? '—'}
        {age != null && age < 18 ? <span className="minor">minor</span> : null}
      </td>
      <td>{api.statusTag(v)}</td>
      <td>{v.city ?? '—'}</td>
      <td className="wraphc">
        {areas.length ? (
          <span className="hclamp" title={areas.join(', ')}>
            {helpAreasText(v)}
          </span>
        ) : (
          '—'
        )}
      </td>
      <td>{v.availability ?? '—'}</td>
    </>
  );
};

const renderDetail = (row: Row, api: TableApi) => {
  const selected = row as VolunteerRow;
  const { removeRow, statusTag, statusBox, seasonField, customFields, internalNoteField } = api;
  const age = ageOf(selected.birthDate);
  const areas = helpAreasOf(selected);
  const hasParent = Boolean(selected.parentName || selected.parentPhone || selected.parentalConsent);
  return (
    <>
      <div className="ph">
        <b>
          {selected.fullName ?? '—'}
          {age != null && age < 18 ? <span className="minor">minor</span> : null}
        </b>
        {statusTag(selected)}
      </div>
      <div className="pb">
        {statusBox(selected)}
        <div className="fld">
          <label>Trimis la</label>
          <div className="v">{fmtDateTime(selected.submittedAt)}</div>
        </div>
        {seasonField(selected)}
        <div className="fld">
          <label>Data nașterii</label>
          <div className="v">
            {selected.birthDate ? (
              <>
                {selected.birthDate}
                {age != null ? ` · ${age} ani` : ''}
              </>
            ) : (
              '—'
            )}
          </div>
        </div>
        {(
          [
            ['email', 'E-mail'],
            ['phone', 'Telefon'],
            ['city', 'Oraș'],
            ['occupation', 'Ocupație'],
          ] as Array<[keyof VolunteerRow & string, string]>
        ).map(([key, label]) => (
          <div className="fld" key={key}>
            <label>{label}</label>
            <div className="v">{String(selected[key] ?? '') || '—'}</div>
          </div>
        ))}
        <div className="fld">
          <label>Cum ajută</label>
          <div className="v">{areas.length ? helpAreasText(selected) : '—'}</div>
        </div>
        {(
          [
            ['availability', 'Disponibilitate'],
            ['frequency', 'Frecvență'],
            ['skatingExperience', 'Experiență cu patinajul'],
          ] as Array<[keyof VolunteerRow & string, string]>
        ).map(([key, label]) => (
          <div className="fld" key={key}>
            <label>{label}</label>
            <div className="v">{String(selected[key] ?? '') || '—'}</div>
          </div>
        ))}
        <div className="fld" style={{ marginTop: 11 }}>
          <label>Experiență cu copiii</label>
          <div className="v">{String(selected.childrenExperience ?? '') || '—'}</div>
        </div>
        <div className="fld">
          <label>Motivație</label>
          <div className="v">{String(selected.motivation ?? '') || '—'}</div>
        </div>
        <div className="fld">
          <label>Cum a aflat</label>
          <div className="v">{String(selected.howHeard ?? '') || '—'}</div>
        </div>
        {hasParent && (
          <div className="fld">
            <label>Părinte / tutore</label>
            <div className="v">
              {[selected.parentName, selected.parentPhone].filter(Boolean).join(' · ') || '—'}
              {selected.parentalConsent === true ? ' · acord parental: Da' : ''}
            </div>
          </div>
        )}
        <div className="fld">
          <label>Acord confidențialitate</label>
          <div className="v">{selected.privacyConsent ? 'Da' : 'Nu'}</div>
        </div>
        {customFields(selected)}
        {internalNoteField(selected)}
      </div>
      <div className="pa">
        <span />
        <button className="btn danger sm" type="button" onClick={() => removeRow(selected.documentId)}>
          Șterge cererea
        </button>
      </div>
    </>
  );
};

const CFG: SubmissionTableCfg = {
  api: '/api/forms/voluntari',
  storagePrefix: 'edusport-voluntari-cols',
  // 1 = submittedAt moved first and status moved directly after `fullName`.
  colConfigVersion: 1,
  csvPrefix: 'voluntari',
  statuses: [
    { value: 'Nou', color: '#2138b8', soft: '#eef1fb', border: '#c6cff2' },
    { value: 'Contactat', color: '#00757f', soft: '#e2f4f5', border: '#b6dde0' },
    { value: 'Acceptat', color: '#1f7a4d', soft: '#e5f3ec', border: '#bfe0cc' },
    { value: 'Respins', color: '#be3330', soft: '#fbeeed', border: '#e6c3c1' },
  ],
  builtinColumns: BUILTIN_COLUMNS,
  registryColKeys: REGISTRY_COL_KEYS,
  defaultHidden: DEFAULT_HIDDEN,
  filterColumns: FILTER_COLUMNS,
  quickFilterCols: ['status', 'availability'],
  seasons: false,
  archive: false,
  sheetsForm: 'voluntari',
  bulk: false,
  texts: {
    title: 'Voluntari',
    subtitle: 'Cererile de voluntariat trimise din pagina publică de voluntariat.',
    // The server's quick `q` searches fullName/email/phone/city only.
    searchPlaceholder: 'Caută după nume, email, telefon sau oraș...',
    empty: 'Nicio cerere pentru filtrul curent.',
    loadError: 'Nu am putut încărca cererile.',
    statSuffix: '',
    deleteConfirm: 'Ștergi definitiv această cerere de voluntariat? Acțiunea nu poate fi anulată.',
    // Bulk is disabled for Voluntari (`bulk: false`), but the config stays coherent.
    bulkDeleteNoun: 'cereri de voluntariat',
    deleteError: 'Nu am putut șterge cererea.',
    saveError: 'Nu am putut salva modificarea.',
  },
  compact: {
    headers: ['Trimis la', 'Nume', 'Status', 'Oraș', 'Cum ajută', 'Disponibilitate'],
    renderCells,
    renderDetail,
  },
  extraCss: `
.insp .minor{display:inline-block;margin-left:6px;font-size:9.5px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:#8a5a00;background:#fbf1df;border:1px solid #ecd9ac;border-radius:4px;padding:1px 6px;vertical-align:1px}
.insp .clist td.wraphc{white-space:normal;min-width:220px;max-width:420px}
.insp .clist td.wraphc .hclamp{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;line-height:1.35}
`,
};

export default function VoluntariPage() {
  return <SubmissionTablePage cfg={CFG} />;
}
