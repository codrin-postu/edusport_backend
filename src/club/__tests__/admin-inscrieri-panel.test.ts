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
  expect(data).toContain('Promise.all([get(CLUB_URLS.match(documentId)), get(CLUB_URLS.history(documentId))])');
  expect(tabs).toContain('<RegistrationDocuments row={row} />');
  expect(tabs).toContain('<RegistrationEmail row={row} />');
  expect(tabs).toContain('historyHead(line, fmtDateTime)');
  expect(dateTab).toContain('{api.internalNoteField(row)}');
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
  expect(menu).toContain('moveTargets(meta, row.schoolId)');
  expect(undo).toContain('await post(CLUB_URLS.undo(registrationId));');
  expect(undo).toContain('adminToast.success(INSCRIERI_PENDING_COPY.undone);');
});

it('?open= mode shows a way back to the full list; the "..." button is named for screen readers', () => {
  const controls = read('inscrieri', 'ListControls.tsx');
  expect(controls).toContain("navigate({ search: '' })");
  expect(controls).toContain('{INSCRIERI_PENDING_COPY.backToList}');
  expect(menu).toContain('<span className="ui-sr">{PANEL_COPY.moreLabel}</span>');
});
