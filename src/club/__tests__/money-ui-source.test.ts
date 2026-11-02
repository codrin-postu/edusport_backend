import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { KIND_OPTIONS } from '../../admin/pages/preturi/format';

// The admin bundle has no test runner; these read its source.
const src = (p: string) => readFileSync(join(__dirname, '..', '..', p), 'utf8');

describe('money UI source', () => {
  it('the bar draws square segments with tokens, no circle (decided 8)', () => {
    const s = src('admin/dashboard/bani/AbonamentBar.tsx') + src('admin/dashboard/bani/styles.ts');
    expect(s).toMatch(/barSegments\(/);
    expect(s).toMatch(/SUBSCRIPTION_COPY\.(usedText|leftText)/);
    expect(s).not.toMatch(/border-radius:\s*50%|borderRadius:\s*'50%'|dashed|dotted|#[0-9a-f]{3,6}\b/i);
  });
  it('one submit per click (decided 1)', () => {
    expect(src('admin/dashboard/bani/useSubmitOnce.ts')).toMatch(/inFlight\.current/);
  });
  it('undo toasts use the server action id and 8 s', () => {
    expect(src('admin/dashboard/bani/undo.ts')).toMatch(/UNDO_MS/);
  });
  it('the payment window and the cancel dialog (5.10)', () => {
    const w = src('admin/dashboard/bani/PaymentWindow.tsx');
    for (const name of ['useSubmitOnce', 'newDraft', 'checkDraft', 'toBody', 'emailBox']) expect(w).toContain(name);
    expect(w).not.toMatch(/sendEmail:\s*true/);
    expect(w).toMatch(/mode !== 'new'|mode === 'new'/);
    expect(w).toMatch(/PAYMENT_COPY\.(titleNew|record)/);
    expect(w).not.toMatch(/['`](Înregistrează|Renunță|Plată nouă|Salvează)['`]/);
    const c = src('admin/dashboard/bani/CancelPaymentDialog.tsx');
    expect(c).toMatch(/cancelText\(/);
    expect(c).toMatch(/moneyUndoToast\(/);
  });
  it('the Plăți list (5.10)', () => {
    const l = src('admin/dashboard/bani/PlatiList.tsx');
    for (const name of ['platiCells', 'rowMenu', 'totalLine', 'PaymentWindow', 'CancelPaymentDialog']) expect(l).toContain(name);
    expect(src('admin/dashboard/bani/styles.ts')).toMatch(/text-decoration:\s*line-through/);
    expect(l + src('admin/dashboard/bani/styles.ts')).not.toMatch(/#[0-9a-f]{3,6}\b|rgb\(/i);
    expect(src('admin/dashboard/PlatiPage.tsx')).toContain('PlatiList');
  });
  it('the Abonamente page (5.8, 5.9)', () => {
    const l = src('admin/dashboard/bani/AbonamenteList.tsx');
    for (const name of ['abonamenteCells', 'abonamentMenu', 'athleteTabTo', 'ExtendModal', 'AddSubscriptionWindow', 'var(--theme-danger)']) expect(l).toContain(name);
    expect(src('admin/dashboard/AbonamentePage.tsx')).toContain('AbonamenteList');
    const e = src('admin/dashboard/bani/ExtendModal.tsx');
    expect(e).toMatch(/\bkey\b/);
    expect(e).toContain('useSubmitOnce');
    const w = src('admin/dashboard/bani/AddSubscriptionWindow.tsx');
    for (const name of ['addDraft', 'toggleCover', 'coverDisabled', 'addBody', 'useSubmitOnce', 'emailBox']) expect(w).toContain(name);
    expect(w).not.toMatch(/payNow:\s*true|sendEmail:\s*true/);
  });
  it('the De încasat page (5.11)', () => {
    const l = src('admin/dashboard/bani/DeIncasatList.tsx');
    for (const name of ['dueParts', 'schoolCells', 'clubCells', 'payFor', 'noPriceListNotice', 'PaymentWindow', "athleteTabTo(", "'plati'", 'MONEY_UI_COPY.due.empty']) expect(l).toContain(name);
    expect(src('admin/dashboard/DeIncasatPage.tsx')).toContain('DeIncasatList');
  });
  it('the athlete tabs (5.7)', () => {
    const r = src('admin/dashboard/sportivi/AthleteRecordPage.tsx');
    for (const name of ['AbonamentTab', 'PlatiTab', 'tabFromSearch', "tab === 'abonament'", "tab === 'plati'"]) expect(r).toContain(name);
    const a = src('admin/dashboard/bani/AbonamentTab.tsx');
    for (const name of ['AbonamentBar', 'AddSubscriptionWindow', 'MONEY_UI_COPY', 'copy.none', 'SessionPanel', 'attendanceLine(']) expect(a).toContain(name);
    expect(a + src('admin/dashboard/bani/styles.ts')).toMatch(/\.bn-warn\{color:var\(--theme-warning\)\}/);
    expect(a).not.toMatch(/#[0-9a-f]{3,6}\b|rgb\(/i);
    const p = src('admin/dashboard/bani/PlatiTab.tsx');
    for (const name of ['paymentsReadOnly', 'readOnly', 'ExpandableRow', 'platiCells', 'rowMenu', 'PaymentWindow', 'CancelPaymentDialog']) expect(p).toContain(name);
    expect(p).toMatch(/!readOnly &&/);
    expect(p).toMatch(/if \(readOnly\) return cols/);
  });
  it('the move window shows the carried abonament, only when moving (5.12)', () => {
    const m = src('admin/dashboard/grupe/MoveDialog.tsx');
    for (const name of ['movePreview', 'moveBarView', '<AbonamentBar']) expect(m).toContain(name);
    expect(m).toMatch(/mode !== 'move'/);
    expect(src('admin/dashboard/grupe/api.ts')).toContain('movePreview');
  });
  it('the session panel row menu (5.3, C44)', () => {
    const p = src('admin/dashboard/prezenta/SessionPanel.tsx');
    expect(p).toContain('RowMoneyMenu');
    const m = src('admin/dashboard/prezenta/RowMoneyMenu.tsx');
    for (const name of ['AddSubscriptionWindow', 'PaymentWindow', 'rowMenuItems(', 'payPreselect(', 'athlete={athlete}']) expect(m).toContain(name);
    const v = src('club/prezenta/panel-view.ts');
    expect(v).toContain('MONEY_UI_COPY.menu.addSubscription');
    expect(v).toContain('MONEY_UI_COPY.menu.addPayment');
    expect(v).toMatch(/kind === 'school' \? \[\{ key: 'subscription'/);
  });
  it('delete reads the counts first and refuses (5.14)', () => {
    const r = src('admin/dashboard/sportivi/RecordMenu.tsx');
    for (const name of ['refusalCounts', 'isBlocked', 'DeleteRefusalDialog', 'readRefusal']) expect(r).toContain(name);
    const d = src('admin/dashboard/sportivi/DeleteRefusalDialog.tsx');
    expect(d).toMatch(/isSuperAdmin && <Button[^\n]*LIFECYCLE_DELETE\.anonymize/);
    expect(d).toContain('deleteBlockedText');
    expect(d).not.toMatch(/#[0-9a-f]{3,6}\b|rgb\(/i);
  });
  it('the Sportivi Abonament column after the group, and Prețuri "Uscat" (5.13, 5.15)', () => {
    const t = src('admin/dashboard/sportivi/AthleteTable.tsx');
    expect(t).toContain('abonamentCell(row)');
    expect(t.indexOf('groupCell(row)')).toBeLessThan(t.indexOf('abonamentCell(row)'));
    expect(t.indexOf('groupHeader(')).toBeLessThan(t.indexOf('LIST_COPY.columns.abonament'));
    expect(src('admin/dashboard/sportivi/AthleteCards.tsx')).toContain('abonamentCell(row)');
    expect(KIND_OPTIONS).toContainEqual({ value: 'uscat', label: 'Uscat' });
  });
  it('the Setări page keeps the attendance start field (5.16, plan 5-5)', () => {
    const page = src('admin/pages/SetariSitePage.tsx');
    expect(page).toContain('SETARI_COPY.attendanceStart');
    const copy = src('club/presence/copy/prezenta-ui.ts');
    expect(copy).toContain('Prezență și plăți din');
    expect(copy).toContain('Ședințele dinainte nu apar ca nefăcute.');
  });
});
