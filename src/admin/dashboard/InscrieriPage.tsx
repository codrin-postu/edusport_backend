import * as React from 'react';
import { useLocation } from 'react-router-dom';
import { Button } from '../ui';
import SubmissionTablePage, {
  DetailBody,
  DetailField,
  DetailFooter,
  DetailHeader,
  fmtDateTime,
  fmtDateShort,
  type ColumnDef,
  type Row,
  type SubmissionTableCfg,
  type SubmissionTableExtras,
  type TableApi,
} from './SubmissionTable';
import { isScriptFormRegistration, registrationPanelRows } from '../../club/registration-panel';
import { LIST_COPY } from '../../club/inscrieri-copy';
import {
  ALL_SCHOOLS,
  EMPTY_LIST_META,
  ageText,
  cellText,
  compactHeaders,
  listParams,
  openListParams,
  readListMeta,
  readOpenParam,
  showsExistingLine,
  statusMenuValues,
  wishText,
  type ListMeta,
} from '../../club/inscrieri-panel';
import { BlankFormsMenu } from './inscrieri/BlankFormsMenu';
import { EditableAnswer } from './inscrieri/EditableAnswer';
import { BulkMoveSchool, ExistingFilter, SchoolTabs } from './inscrieri/ListControls';
import { RegistrationDocuments } from './inscrieri/RegistrationDocuments';
import { RegistrationEmail } from './inscrieri/RegistrationEmail';
import { IconUser } from './inscrieri/icons';
import { INSCRIERI_CSS } from './inscrieri/styles';

/**
 * EduSport admin: the "Înscrieri" page (spec 3). A configuration of the shared SubmissionTablePage plus the
 * page state the table does not own ("Sportiv existent" filter, school tabs, bulk school move), passed as extras.
 * Rows come from GET /api/forms/inscrieri with plan 3-2's extras (age, existingAthlete, athleteId, canUndo,
 * schoolId, schoolName) and the top-level school data (schools, multipleSchools, allSchoolsTotal).
 * Google Sheets is a live connection, not an export: see SheetsDialog.tsx and the /api/sheets/* endpoints.
 */

const LEVELS = [
  'Nu a mai patinat',
  'A mai patinat in alta parte',
  'Incepatori',
  'Intermediari',
  'Avansati',
  'Performanta',
] as const;

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

// Order convention shared with VoluntariPage: `submittedAt`, the row's name column, `status`, then the rest.
// Bump `colConfigVersion` in CFG whenever this order changes (2 = "Vârstă" after the name, spec 3.2).
const BUILTIN_COLUMNS: ColumnDef[] = [
  { key: 'submittedAt', label: 'Trimis la', type: 'date', readOnly: true, width: 150 },
  { key: 'childName', label: 'Nume sportiv', type: 'text', width: 170 },
  { key: 'age', label: 'Vârstă', type: 'text', readOnly: true, width: 90, render: (row) => ageText(row.age) },
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
  { key: 'childName', label: 'Nume sportiv' },
  { key: 'parentName', label: 'Nume părinte' },
  { key: 'level', label: 'Nivel' },
  { key: 'status', label: 'Status' },
  { key: 'phone', label: 'Telefon' },
  { key: 'email', label: 'Email' },
  { key: 'submittedAt', label: 'Data înscrierii' },
] as const;

/** One list row (spec 3.1): the "Sportiv existent" line sits tight under the name; rows without it keep the line empty. */
const renderCells = (r: Row, api: TableApi) => {
  const multiple = readListMeta(api.pageMeta).multipleSchools;
  return (
    <>
      <td className="ui-num ins-nr">{cellText(r.registrationNumber)}</td>
      <td className="ui-num">{fmtDateShort(r.submittedAt)}</td>
      <td className="ins-name">
        <b>{cellText(r.childName)}</b>
        <span className="ins-ex">
          {showsExistingLine(r) && (
            <>
              <IconUser size={12} />
              {LIST_COPY.existing}
            </>
          )}
        </span>
      </td>
      {multiple && <td>{cellText(r.schoolName)}</td>}
      <td className="ui-num">{ageText(r.age)}</td>
      <td>{api.statusTag(r)}</td>
      <td>{cellText(r.parentName)}</td>
      <td>{wishText(r.membershipAnswer)}</td>
    </>
  );
};

/** Answers as label/value rows (src/club/registration-panel.ts), the long texts after a gap. Replaced by the tabs in Task 6. */
function PanelAnswers({ row, save }: { row: Row; save: TableApi['saveField'] }) {
  const { rows, longRows } = registrationPanelRows(row);
  return (
    <>
      {rows.map((r) =>
        r.edit ? (
          <EditableAnswer key={r.label} row={row} edit={r.edit} save={save} />
        ) : (
          <DetailField key={r.label} label={r.label}>{r.value}</DetailField>
        ),
      )}
      {longRows.map((r, i) => (
        <DetailField key={r.label} label={r.label} style={i === 0 ? { marginTop: 11 } : undefined}>
          {r.value}
        </DetailField>
      ))}
    </>
  );
}

const renderDetail = (row: Row, api: TableApi) => {
  const scriptForm = isScriptFormRegistration(row);
  return (
    <>
      <DetailHeader>
        <b>{cellText(row.childName)}</b>
        {api.statusTag(row)}
      </DetailHeader>
      <DetailBody>
        {api.statusBox(row)}
        <DetailField label="Trimis la">{fmtDateTime(row.submittedAt)}</DetailField>
        <DetailField label="Arhivare">{row.archived ? 'Arhivat' : 'Activ'}</DetailField>
        {api.seasonField(row)}
        <PanelAnswers row={row} save={api.saveField} />
        {scriptForm && <RegistrationDocuments row={row} />}
        {scriptForm && <RegistrationEmail row={row} />}
        {api.customFields(row)}
        {api.internalNoteField(row)}
      </DetailBody>
      <DetailFooter>
        <span />
        <Button size="sm" variant="danger" onClick={() => api.removeRow(row.documentId)}>
          Șterge înscrierea
        </Button>
      </DetailFooter>
    </>
  );
};

const CFG: SubmissionTableCfg = {
  api: '/api/forms/inscrieri',
  storagePrefix: 'edusport-inscrieri-cols',
  // 1 = status moved directly after `childName`; 2 = "Vârstă" added after the name.
  colConfigVersion: 2,
  csvPrefix: 'inscrieri',
  statuses: [
    { value: 'Nou', color: 'var(--theme-primary)', soft: 'var(--theme-primary-soft)', border: 'var(--theme-primary-soft-line)' },
    { value: 'Contactat', color: 'var(--theme-info)', soft: 'var(--theme-info-bg)', border: 'var(--theme-info-border)' },
    { value: 'Confirmat', color: 'var(--theme-success)', soft: 'var(--theme-success-bg)', border: 'var(--theme-success-border)' },
    { value: 'Respins', color: 'var(--theme-danger)', soft: 'var(--theme-danger-bg)', border: 'var(--theme-danger-border)' },
  ],
  extraTags: [{ value: 'Arhivat', color: 'var(--theme-neutral)', soft: 'var(--theme-neutral-bg)', border: 'var(--theme-neutral-border)' }],
  // "Confirmat" only through "Confirmă înscrierea" (spec 3.2, 3.5); none on a Confirmat row (Needs decision 2).
  statusMenu: statusMenuValues,
  builtinColumns: BUILTIN_COLUMNS,
  registryColKeys: REGISTRY_COL_KEYS,
  filterColumns: FILTER_COLUMNS,
  quickFilterCols: ['status', 'level'],
  filterSelectFallback: { level: [...LEVELS] },
  seasons: true,
  archive: true,
  sheetsForm: 'inscrieri',
  bulk: true,
  headerActions: <BlankFormsMenu />,
  extraCss: INSCRIERI_CSS,
  texts: {
    title: 'Înscrieri',
    subtitle: 'Cererile trimise prin formularul public de înscriere.',
    searchPlaceholder: LIST_COPY.searchPlaceholder,
    empty: 'Nicio înscriere pentru filtrul curent.',
    loadError: 'Nu am putut încărca înscrierile.',
    statSuffix: ', exclus arhivate',
    deleteConfirm: 'Ștergi definitiv această înscriere și documentele ei? Acțiunea nu poate fi anulată.',
    bulkDeleteNoun: 'înscrieri',
    deleteError: 'Nu am putut șterge înscrierea.',
    saveError: 'Nu am putut salva modificarea.',
  },
  compact: {
    headers: (api) => compactHeaders(readListMeta(api.pageMeta).multipleSchools),
    renderCells,
    renderDetail,
  },
};

export default function InscrieriPage() {
  const open = readOpenParam(useLocation().search);
  const [existing, setExisting] = React.useState('');
  const [school, setSchool] = React.useState<string>(ALL_SCHOOLS);
  const [meta, setMeta] = React.useState<ListMeta>(EMPTY_LIST_META);
  const onMeta = React.useCallback((m: Record<string, unknown>) => setMeta(readListMeta(m)), []);
  const extras: SubmissionTableExtras = {
    params: open ? openListParams(open) : listParams(existing, school, meta),
    onMeta,
    toolbar: <ExistingFilter value={existing} onChange={setExisting} />,
    aboveList: <SchoolTabs meta={meta} value={school} onChange={setSchool} />,
    bulkActions: meta.multipleSchools ? (ids, done) => <BulkMoveSchool ids={ids} meta={meta} done={done} /> : undefined,
  };
  return <SubmissionTablePage cfg={CFG} extras={extras} />;
}
