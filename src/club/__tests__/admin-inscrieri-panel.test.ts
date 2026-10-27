import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';

// The admin bundle has no test runner; these read its source.
const dir = join(__dirname, '..', '..', 'admin', 'dashboard');
const read = (...p: string[]) => readFileSync(join(dir, ...p), 'utf8');
const page = read('InscrieriPage.tsx');
const panel = read('inscrieri', 'RegistrationPanel.tsx');
const header = read('inscrieri', 'PanelHeader.tsx');
const menu = read('inscrieri', 'PanelMenu.tsx');
const tabs = read('inscrieri', 'PanelTabs.tsx');
const dateTab = read('inscrieri', 'DateTab.tsx');
const data = read('inscrieri', 'usePanelData.ts');
const undo = read('inscrieri', 'undo.ts');

it('the panel replaces the flat list; the in-place edits are gone (spec 3.3)', () => {
  expect(page).toContain('const renderDetail = (row: Row, api: TableApi) => <RegistrationPanel key={row.documentId} row={row} api={api} />;');
  expect(page).not.toContain('PanelAnswers');
  expect(existsSync(join(dir, 'inscrieri', 'EditableAnswer.tsx'))).toBe(false);
});

it('fixed header: name, badge, "..." menu, Nr., Trimis, the status menu (Needs decision 1, A)', () => {
  expect(header).toContain('{api.statusTag(row)}');
  expect(header).toContain('<PanelMenu row={row} api={api} />');
  expect(header).toContain('{PANEL_COPY.number} <b className="ui-num">{nr}</b>');
  expect(header).toContain('{PANEL_COPY.submitted} <b>{fmtDateTime(row.submittedAt)}</b>');
  expect(header).toContain('{api.statusBox(row)}');
});

it('tabs Date | Abonament | Documente (n) | Istoric (n), reloaded when the row changes', () => {
  expect(panel).toContain('items={panelTabs(row, data.history ? data.history.length : null)}');
  expect(panel).toContain('usePanelData(row.documentId, panelVersion(row))');
  expect(data).toContain('useLoad(CLUB_URLS.match(documentId), version, isMatch)');
  expect(data).toContain('useLoad(CLUB_URLS.history(documentId), version, isHistory)');
  expect(tabs).toContain('<RegistrationDocuments row={row} />');
  expect(tabs).toContain('<RegistrationEmail row={row} />');
  expect(tabs).toContain('historyHead(line, fmtDateTime)');
  expect(dateTab).toContain(': api.internalNoteField(row)}');
});

it('footer: Contactat sets the status, Confirmă waits for the window, the record opens in the same tab', () => {
  expect(panel).toContain("api.saveField(row.documentId, 'status', 'Contactat')");
  expect(panel).toContain('disabled={!onConfirm}');
  expect(panel).toContain('navigate(athleteRecordPath(athleteId))');
});

it('"..." menu: undo asks first, move picks a school, delete uses the table dialog', () => {
  expect(menu).toContain('menuItems(row, meta.multipleSchools)');
  expect(menu).toMatch(/<ConfirmDialog\s+open\s+title=\{c\.title\}\s+message=\{c\.message\}\s+confirmLabel=\{c\.confirm\}/);
  expect(menu).toContain("if (item === 'delete') api.removeRow(row.documentId);");
  expect(menu).toContain('placeholder={LIST_COPY.pickSchool} options={moveTargets(meta, row.schoolId)}');
  expect(undo).toContain('await post(CLUB_URLS.undo(registrationId));');
  expect(undo).toContain('adminToast.success(INSCRIERI_PENDING_COPY.undone);');
});

it('?open= mode shows a way back to the full list; the "..." button is named for screen readers', () => {
  const controls = read('inscrieri', 'ListControls.tsx');
  expect(controls).toContain("navigate({ search: '' })");
  expect(controls).toContain('{INSCRIERI_PENDING_COPY.backToList}');
  expect(menu).toContain('<span className="ui-sr">{PANEL_COPY.moreLabel}</span>');
});

it('fix round 1: undo busy label, plain "..." trigger, named tabs, focus after Contactat', () => {
  expect(menu).toContain('busy={busy} busyLabel={c.confirm}');
  expect(menu).toContain('popClassName="sbt-menu" role="menu" chevron={false} placement="bottom-end">');
  expect(panel).toContain('label={cellText(row.childName)}');
  expect(panel).toContain('panelId={PANEL_BODY_ID}');
  expect(panel).toContain('<div role="tabpanel" id={PANEL_BODY_ID} aria-label={PANEL_COPY.tabs[tab]}>');
  expect(panel).toContain('onContacted={() => focusAfterContactat(ref.current)}');
  expect(panel).toContain(".querySelector<HTMLElement>('.sbt-statusbox [role=\"combobox\"]') ?? panel?.querySelector<HTMLElement>('.ins-ph-name')");
  expect(header).toContain('<b className="ins-ph-name" tabIndex={-1}>');
});

it('fix round 1: match and history load apart; a failed or malformed history shows the load error', () => {
  expect(data).not.toContain('Promise.all');
  expect(data).toContain('const isHistory = (v: unknown): v is HistoryLine[] => Array.isArray(v);');
  expect(data).toContain('setState(valid(value) ? { value, failed: false } : { value: null, failed: true })');
  expect(data).toContain('return { match: match.value, history: history.value, failed: history.failed, matchFailed: match.failed };');
  expect(tabs).toContain('if (data.failed) return <p className="ins-empty">{INSCRIERI_PENDING_COPY.loadFailed}</p>;');
});

it('fix round 1: Istoric as v5, bold head in the text colour, solid dividers', () => {
  const css = read('inscrieri', 'styles.ts');
  expect(css).toContain("'.ui-root .ins-his li + li{border-top:1px solid var(--theme-border)}'");
  expect(css).toContain("'.ui-root .ins-his-h{font-size:12.5px;font-weight:700;color:var(--theme-text)}'");
  expect(css).not.toMatch(/dashed|dotted/);
});

it('a registration of an anonymized athlete is read-only: no "Editează", no editable extras, no "..." (3C spec 4)', () => {
  expect(dateTab).toContain('if (isAnonymizedRow(row)) return <ReadOnlyDate row={row} api={api} />;');
  expect(dateTab).toContain('{readOnly ? <DetailField label={REGISTRATION_FIELD_LABELS.season}>{cellText(row.season)}</DetailField> : api.seasonField(row)}');
  expect(dateTab).toContain('{readOnly ? <DetailField label={REGISTRATION_FIELD_LABELS.internalNote}>{cellText(row.internalNote)}</DetailField> : api.internalNoteField(row)}');
  expect(dateTab.split('function ReadOnlyDate')[1].split('\n}')[0]).not.toContain('EditLabel');
  expect(menu).toContain('if (items.length === 0) return null;');
  const controller = readFileSync(join(__dirname, '..', '..', 'api', 'registration-submission', 'controllers', 'registration-submission.ts'), 'utf8');
  expect(controller).toContain("athlete: { fields: ['documentId', 'name', 'status'] }");
});
