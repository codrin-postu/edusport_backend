import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { runOnce } from '../../admin/dashboard/bani/useSubmitOnce';
import { MONEY_UI_COPY } from '../presence/copy/money-ui';
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
  it('one submit per click (decided 1): a second call while one is in flight does not start the work', async () => {
    const flag = { current: false };
    const busy: boolean[] = [];
    let release: (v: string) => void = () => undefined;
    let starts = 0;
    const work = () => { starts += 1; return new Promise<string>((resolve) => { release = resolve; }); };
    const first = runOnce(flag, work, (b) => busy.push(b));
    expect(await runOnce(flag, work, (b) => busy.push(b))).toBeUndefined();
    expect(starts).toBe(1);
    release('done');
    expect(await first).toBe('done');
    expect([flag.current, busy]).toEqual([false, [true, false]]);
    await expect(runOnce(flag, () => Promise.reject(new Error('x')), () => undefined)).rejects.toThrow('x');
    expect(flag.current).toBe(false);   // a failure frees the guard
    expect(src('admin/dashboard/bani/useSubmitOnce.ts')).toMatch(/runOnce\(inFlight/);
  });
  it('undo toasts use the server action id, 8000 ms and the "Anulează" action', () => {
    const u = src('admin/dashboard/bani/undo.ts');
    expect(u).toContain('UNDO_MS = 8000');
    expect(u).toMatch(/duration: UNDO_MS, action: \{ label: MONEY_UI_COPY\.undo\.action, onClick: \(\) => void runUndo\(api, actionId\)/);
    expect(u).toContain('if (!actionId)');
  });
  it('empty states use the ruled texts on every list, card list and athlete block (I4)', () => {
    const c = MONEY_UI_COPY.empty;
    expect(c).toEqual({ abonamente: 'Niciun abonament.', plati: 'Nicio plată.', month: 'Nicio prezență în luna aceasta.', earlier: 'Niciun abonament anterior.' });
    const plati = src('admin/dashboard/bani/PlatiList.tsx');
    expect(plati).toMatch(/empty=\{MONEY_UI_COPY\.empty\.plati\}/);
    expect(plati).toMatch(/rows\.length === 0\) return <p[^\n]*empty\.plati/);
    const ab = src('admin/dashboard/bani/AbonamenteList.tsx');
    expect(ab).toMatch(/empty=\{MONEY_UI_COPY\.empty\.abonamente\}/);
    expect(ab).toMatch(/rows\.length === 0\) return <p[^\n]*empty\.abonamente/);
    const tab = src('admin/dashboard/bani/PlatiTab.tsx');
    expect(tab).toMatch(/empty=\{MONEY_UI_COPY\.empty\.plati\}/);
    expect(tab).toMatch(/data\.months\.length > 0 && <MonthRows/);   // a school athlete has no month rows: no bare header
    const a = src('admin/dashboard/bani/AbonamentTab.tsx');
    expect(a).toContain('MONEY_UI_COPY.empty.month');
    expect(a).toContain('MONEY_UI_COPY.empty.earlier');
  });
  it('strings outside the copy module moved in (M8)', () => {
    for (const f of ['PlatiList', 'AbonamenteList']) expect(src(`admin/dashboard/bani/${f}.tsx`)).not.toContain('`Arată ');
    expect(MONEY_UI_COPY.show('3 plăți')).toBe('Arată 3 plăți');
    expect(src('admin/dashboard/bani/DeIncasatList.tsx')).not.toContain('showLabel=""');
    for (const f of ['bani', 'prezenta']) expect(src(`admin/dashboard/${f}/undo.ts`)).not.toMatch(/'Anulează'|'Anulat\.'/);
    expect(MONEY_UI_COPY.undo).toEqual({ action: 'Anulează', done: 'Anulat.' });
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
    expect(r).toContain('seasonId={record.season?.documentId ?? null}');
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
    expect(d).toMatch(/anonymizeOffered\(isSuperAdmin\) && <p[^\n]*anonymizeInstead/);
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
