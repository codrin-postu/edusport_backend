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
 * EduSport admin — "Înscrieri" results page.
 *
 * A thin configuration wrapper around the shared SubmissionTablePage (the table
 * machinery originally lived here and was extracted verbatim — see
 * ./SubmissionTable.tsx). Everything below only describes the registration
 * screen: endpoints, statuses, built-in columns, filterable columns, the
 * compact-list cells and the read-only detail panel. Seasons, the archived view,
 * bulk actions and the Google Sheets connection are enabled here.
 *
 * Endpoints (admin-guarded, server-side filtering/sorting/pagination):
 *   GET    /api/forms/inscrieri
 *            ?season&archived&q&filters&sort&page&pageSize
 *            -> { data, pagination, seasons, activeSeason, formMeta }
 *   PUT    /api/forms/inscrieri/:documentId     update editable field
 *   DELETE /api/forms/inscrieri/:documentId     permanent delete
 *   GET    /api/forms/inscrieri/export.csv        CSV (respects season+filters)
 *
 * Google Sheets is a live connection, not an export: see SheetsDialog.tsx and
 * the /api/sheets/* endpoints.
 */

const LEVELS = [
  'Nu a mai patinat',
  'A mai patinat in alta parte',
  'Incepatori',
  'Intermediari',
  'Avansati',
  'Performanta',
] as const;

interface Submission extends Row {
  email: string;
  phone: string;
  childName: string;
  childBirthDate: string;
  parentName: string;
  shirtSize: string;
  howHeard: string;
  level: string;
  priorExperience: string | null;
  expectations: string | null;
  clubInterest: boolean;
  regulationsAgreement: boolean;
  privacyConsent: boolean;
}

// The registry keys that map to editable/removable built-in columns. status,
// submittedAt and internalNote are meta columns and are never "removed".
const REGISTRY_COL_KEYS = [
  'childName',
  'childBirthDate',
  'parentName',
  'email',
  'phone',
  'level',
  'shirtSize',
  'howHeard',
  'clubInterest',
  'regulationsAgreement',
  'privacyConsent',
  'priorExperience',
  'expectations',
];

// Order convention shared with VoluntariPage: `submittedAt`, the row's name
// column, `status`, then the rest. Bump `colConfigVersion` in CFG whenever this
// order changes so saved per-user orders do not pin the old positions.
const BUILTIN_COLUMNS: ColumnDef[] = [
  { key: 'submittedAt', label: 'Trimis la', type: 'date', readOnly: true, width: 150 },
  { key: 'childName', label: 'Nume copil', type: 'text', width: 170 },
  { key: 'status', label: 'Status', type: 'status', width: 130 },
  { key: 'childBirthDate', label: 'Data nașterii', type: 'text', width: 150 },
  { key: 'parentName', label: 'Nume părinte', type: 'text', width: 170 },
  { key: 'email', label: 'Email', type: 'text', width: 210 },
  { key: 'phone', label: 'Telefon', type: 'text', width: 140 },
  { key: 'level', label: 'Nivel', type: 'level', width: 190 },
  { key: 'shirtSize', label: 'Mărime tricou', type: 'text', width: 120 },
  { key: 'howHeard', label: 'Cum a aflat', type: 'text', width: 170 },
  { key: 'clubInterest', label: 'Interes club', type: 'bool', width: 110 },
  { key: 'regulationsAgreement', label: 'Acord regulament', type: 'bool', width: 150 },
  { key: 'privacyConsent', label: 'Confidențialitate', type: 'bool', width: 140 },
  { key: 'priorExperience', label: 'Experiență anterioară', type: 'longtext', width: 240 },
  { key: 'expectations', label: 'Așteptări', type: 'longtext', width: 240 },
  { key: 'internalNote', label: 'Notă internă', type: 'longtext', width: 240 },
];

// Filter-builder column options (map to whitelisted server fields).
const FILTER_COLUMNS = [
  { key: 'childName', label: 'Nume copil' },
  { key: 'parentName', label: 'Nume părinte' },
  { key: 'level', label: 'Nivel' },
  { key: 'status', label: 'Status' },
  { key: 'phone', label: 'Telefon' },
  { key: 'email', label: 'Email' },
  { key: 'submittedAt', label: 'Data înscrierii' },
] as const;

const renderCells = (r: Row, api: TableApi) => {
  const s = r as Submission;
  return (
    <>
      <td className="sub num">{fmtDateShort(s.submittedAt)}</td>
      <td className="nm">{s.childName}</td>
      <td>{api.statusTag(s)}</td>
      <td>{s.parentName}</td>
      <td>
        <span className="lvchip">{s.level}</span>
      </td>
    </>
  );
};

const renderDetail = (row: Row, api: TableApi) => {
  const selected = row as Submission;
  const { removeRow, statusTag, statusBox, seasonField, customFields, internalNoteField } = api;
  return (
    <>
      <div className="ph">
        <b>{selected.childName}</b>
        {statusTag(selected)}
      </div>
      <div className="pb">
        {statusBox(selected)}
        <div className="fld">
          <label>Trimis la</label>
          <div className="v">{fmtDateTime(selected.submittedAt)}</div>
        </div>
        <div className="fld">
          <label>Arhivare</label>
          <div className="v">{selected.archived ? 'Arhivat' : 'Activ'}</div>
        </div>
        {seasonField(selected)}
        {(
          [
            ['childBirthDate', 'Data nașterii'],
            ['parentName', 'Nume părinte'],
            ['email', 'Email'],
            ['phone', 'Telefon'],
            ['shirtSize', 'Mărime tricou'],
            ['howHeard', 'Cum a aflat'],
            ['level', 'Nivel'],
          ] as Array<[string, string]>
        ).map(([key, label]) => (
          <div className="fld" key={key}>
            <label>{label}</label>
            <div className="v">{String(selected[key] ?? '') || '—'}</div>
          </div>
        ))}
        <div className="fld">
          <label>Interes club</label>
          <div className="v">{selected.clubInterest ? 'Da' : 'Nu'}</div>
        </div>
        <div className="fld">
          <label>Acord regulament</label>
          <div className="v">{selected.regulationsAgreement ? 'Da' : 'Nu'}</div>
        </div>
        <div className="fld">
          <label>Acord confidențialitate</label>
          <div className="v">{selected.privacyConsent ? 'Da' : 'Nu'}</div>
        </div>
        <div className="fld" style={{ marginTop: 11 }}>
          <label>Experiență anterioară</label>
          <div className="v">{String(selected.priorExperience ?? '') || '—'}</div>
        </div>
        <div className="fld">
          <label>Așteptări</label>
          <div className="v">{String(selected.expectations ?? '') || '—'}</div>
        </div>
        {customFields(selected)}
        {internalNoteField(selected)}
      </div>
      <div className="pa">
        <span />
        <button className="btn danger sm" type="button" onClick={() => removeRow(selected.documentId)}>
          Șterge înscrierea
        </button>
      </div>
    </>
  );
};

const CFG: SubmissionTableCfg = {
  api: '/api/forms/inscrieri',
  storagePrefix: 'edusport-inscrieri-cols',
  // 1 = status moved directly after `childName`.
  colConfigVersion: 1,
  csvPrefix: 'inscrieri',
  statuses: [
    { value: 'Nou', color: '#2138b8', soft: '#eef1fb', border: '#c6cff2' },
    { value: 'Contactat', color: '#00757f', soft: '#e2f4f5', border: '#b6dde0' },
    { value: 'Confirmat', color: '#1f7a4d', soft: '#e5f3ec', border: '#bfe0cc' },
    { value: 'Respins', color: '#be3330', soft: '#fbeeed', border: '#e6c3c1' },
  ],
  extraTags: [{ value: 'Arhivat', color: '#6a6e7a', soft: '#eceef2', border: '#d3d6dd' }],
  builtinColumns: BUILTIN_COLUMNS,
  registryColKeys: REGISTRY_COL_KEYS,
  filterColumns: FILTER_COLUMNS,
  quickFilterCols: ['status', 'level'],
  filterSelectFallback: { level: [...LEVELS] },
  seasons: true,
  archive: true,
  sheetsForm: 'inscrieri',
  bulk: true,
  texts: {
    title: 'Înscrieri',
    subtitle: 'Cererile trimise prin formularul public de înscriere.',
    // The server's quick `q` searches childName/parentName/email/phone only.
    searchPlaceholder: 'Caută după nume, părinte, email sau telefon...',
    empty: 'Nicio înscriere pentru filtrul curent.',
    loadError: 'Nu am putut încărca înscrierile.',
    statSuffix: ' · exclus arhivate',
    deleteConfirm: 'Ștergi definitiv această înscriere? Acțiunea nu poate fi anulată.',
    bulkDeleteNoun: 'înscrieri',
    deleteError: 'Nu am putut șterge înscrierea.',
    saveError: 'Nu am putut salva modificarea.',
  },
  compact: {
    headers: ['Trimis la', 'Nume copil', 'Status', 'Nume părinte', 'Nivel'],
    renderCells,
    renderDetail,
  },
};

export default function InscrieriPage() {
  return <SubmissionTablePage cfg={CFG} />;
}
