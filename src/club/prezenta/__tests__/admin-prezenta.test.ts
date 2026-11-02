import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';

const ADMIN = join(__dirname, '..', '..', '..', 'admin');
const ROOT = join(__dirname, '..', '..', '..', '..');
const src = (p: string) => readFileSync(join(ADMIN, p), 'utf8');

it('menu: Grupe, Sportivi, Prezență, Abonamente, Plăți, De încasat in Club și școală (5.1, C40)', () => {
  const menu = src('dashboard/menu.tsx');
  const order = ['GRUPE_TO', 'SPORTIVI_TO', 'PREZENTA_PATH', 'ABONAMENTE_PATH', 'PLATI_PATH', 'DE_INCASAT_PATH'].map((k) => menu.indexOf(`{ to: ${k}`));
  expect(order.every((i, n) => i > 0 && (n === 0 || i > order[n - 1]))).toBe(true);
  for (const page of ['PrezentaPage', 'AbonamentePage', 'PlatiPage', 'DeIncasatPage']) expect(menu).toContain(`import('./${page}')`);
  expect(menu).not.toContain('Prezență joins in phase 5');
});

it('the api reaches every plan 5-2 route', () => {
  const api = src('dashboard/prezenta/api.ts');
  for (const p of ['/attendance/day', '/attendance/session/defaults', '/attendance/session/check', '/attendance/session', '/attendance/coaches', 'coaches.csv',
    '/lessons/new', '/lessons', '/attendance', '/groups/options', '/undo']) expect(api, p).toContain(p);
});

it('undo toasts last 8 s with "Anulează" and no X', () => {
  const undo = src('dashboard/prezenta/undo.ts');
  expect(undo).toContain('UNDO_MS = 8000');
  expect(undo).toMatch(/action: \{ label: 'Anulează'/);
});

it('Setări site has "Prezență și plăți din" with its hint (3.8, 5.16)', () => {
  const page = src('pages/SetariSitePage.tsx');
  expect(page).toContain('SETARI_COPY.attendanceStart');
  expect(page).toContain('SETARI_COPY.attendanceStartHint');
  expect(page).toContain('attendanceStartDate');
});

it('the shells carry their titles (Plăți is built since 5-6 T3, Abonamente since T4)', () => {
  expect(src('dashboard/AbonamentePage.tsx')).toContain('AbonamenteList');
  expect(src('dashboard/PlatiPage.tsx')).toContain('PlatiList');
  expect(src('dashboard/DeIncasatPage.tsx')).toContain('SHELL_COPY.deIncasat');
});

it('prezenta components are held to the colour rule', () => {
  expect(readFileSync(join(ROOT, 'scripts/admin-ui-check.mjs'), 'utf8')).toContain("'dashboard', 'prezenta'");
});

it('Prezență: three tabs, notices, the day switcher (5.2, C41)', () => {
  const s = src('dashboard/prezenta/PrezentaScreen.tsx');
  for (const k of ['tabSessions', 'tabLessons', 'tabCoaches', 'startNotice']) expect(s, k).toContain(`PREZENTA_COPY.${k}`);
  expect(s).toContain('noPriceListNotice(');
});
it('Ședințe: undone section above the day, columns, empty text, phone cards (5.2)', () => {
  const d = src('dashboard/prezenta/DayTab.tsx');
  expect(d.indexOf('undoneTitle(')).toBeLessThan(d.indexOf('dayTitle('));
  for (const k of ['colDate', 'colTime', 'colGroup', 'colCoach', 'colState', 'colPresent', 'emptyDay', 'newSession', 'today', 'prevDay', 'nextDay'])
    expect(d, k).toContain(`PREZENTA_COPY.${k}`);
  expect(d).toContain('sessionCard(');
  expect(d).toContain('PRESENCE_WORDS.outsideSchedule');
  expect(d).toMatch(/undone\.length > 0/);
});
it('Ședință nouă: fields, check and the warning (5.4, 4.5)', () => {
  const w = src('dashboard/prezenta/NewSessionWindow.tsx');
  for (const k of ['newSessionTitle', 'colGroup', 'colDate', 'colTime', 'colDuration', 'coach', 'cancel', 'continue']) expect(w, k).toContain(`PREZENTA_COPY.${k}`);
  expect(w).toContain('api.check(');
  expect(w).toContain('durationOptions()');
  const e = src('dashboard/prezenta/ExistingDialog.tsx');
  for (const k of ['title', 'open', 'addAnother']) expect(e, k).toContain(`EXISTING_SESSION.${k}`);
  expect(e).toMatch(/!check\.sameTime/);
});

it('panel: title, coaches, table by section, visitor, footer, saved line, Istoric (5.3)', () => {
  const p = src('dashboard/prezenta/SessionPanel.tsx');
  for (const f of ['panelTitle(', 'longDayTitle(', 'columnsFor(', 'footerText(', 'savedLine', 'initialTicks(', 'saveBody(']) expect(p, f).toContain(f);
  for (const k of ['addVisitor', 'close', 'save', 'history']) expect(p, k).toContain(`PREZENTA_COPY.${k}`);
  expect(p).toContain("hideStatus={['anonimizat']}");
  expect(p).toContain('PRESENCE_WORDS.outsideSchedule');
});
it('panel: closing asks only when dirty; the save toast has no undo (5.3, C46)', () => {
  const p = src('dashboard/prezenta/SessionPanel.tsx');
  expect(p).toContain('isDirty(');
  for (const k of ['closeConfirm', 'stay']) expect(p, k).toContain(`PREZENTA_COPY.${k}`);
  expect(p).not.toMatch(/onClose=\{onClose\}/);
  expect(p).toMatch(/adminToast\.success\([^)]*toast\)/);
  expect(p).not.toMatch(/adminToast\.success\([^)]*toast[^)]*action/);
});
it('panel: inactive 409 dialogs, then one more save; read-only hides Salvează (4.22, 5.6)', () => {
  const p = src('dashboard/prezenta/SessionPanel.tsx');
  expect(p).toContain('readInactive(');
  expect(p).toContain('answerInactive(');
  expect(p).toMatch(/!readOnly && [\s\S]*PREZENTA_COPY\.save/);
  const d = src('dashboard/prezenta/InactiveDialog.tsx');
  for (const k of ['title', 'text(', 'keep', 'reactivate']) expect(d, k).toContain(`REACTIVATE_DIALOG.${k}`);
});
it('coach fields (4.2)', () => {
  const c = src('dashboard/prezenta/CoachFields.tsx');
  expect(c).toContain('PREZENTA_COPY.addCoaches');
  expect(c).toContain('setCoach(');
  expect(c).toContain('SearchableSelect');
});
it('the athlete search can hide anonymized athletes', () => {
  expect(src('dashboard/sportivi/AthleteSearch.tsx')).toMatch(/hideStatus\?: /);
});

it('Lecții individuale: month line, columns, empty, cards (5.2)', () => {
  const t = src('dashboard/prezenta/LessonsTab.tsx');
  for (const k of ['newLesson', 'colDate', 'colTime', 'colAthlete', 'colCoach', 'colDuration', 'colState', 'emptyLessons', 'prevMonth', 'nextMonth'])
    expect(t, k).toContain(`PREZENTA_COPY.${k}`);
  expect(t).toContain('monthTitle(');
  expect(t).toContain('lessonCard(');
});
it('Lecție nouă: fields and undo toast (5.5)', () => {
  const w = src('dashboard/prezenta/NewLessonWindow.tsx');
  for (const k of ['newLessonTitle', 'colAthlete', 'colDate', 'colTime', 'colDuration', 'coach', 'cancel', 'save']) expect(w, k).toContain(`PREZENTA_COPY.${k}`);
  expect(w).toContain("hideStatus={['anonimizat']}");
  expect(w).toContain('undoToast(');
});
it('lesson panel: title, tick, delete only when deletable, with confirmation and undo (5.5, C49)', () => {
  const p = src('dashboard/prezenta/LessonPanel.tsx');
  expect(p).toContain('lessonTitle(');
  expect(p).toMatch(/deletable && [\s\S]*LESSON_COPY\.deleteLink/);
  expect(p).toContain('LESSON_COPY.deleteConfirm(');
  expect(p).toMatch(/undoToast\([^)]*LESSON_COPY\.deleted/);
});
it('Pe antrenori: columns, CSV, empty (5.2, p5 Q24)', () => {
  const c = src('dashboard/prezenta/CoachesTab.tsx');
  for (const k of ['exportCsv', 'colCoach', 'colGroupSessions', 'colLessons', 'colHours', 'emptyCoaches']) expect(c, k).toContain(`PREZENTA_COPY.${k}`);
  expect(c).toContain('api.coachesCsv(');
});

it('group tab Prezență: between Program and Istoric, month list, read-only past season (5.6)', () => {
  const g = src('dashboard/grupe/GroupPage.tsx');
  expect(g).toMatch(/SHOWN[^\n]*'program', 'prezenta', 'istoric'/);
  const t = src('dashboard/grupe/PrezentaTab.tsx');
  for (const k of ['colDate', 'colTime', 'colPresent', 'colCoach', 'colState', 'emptyGroupMonth', 'newSession']) expect(t, k).toContain(`PREZENTA_COPY.${k}`);
  expect(t).toContain('visitorsText(');
  expect(t).toMatch(/writable\(page\) && [\s\S]*NewSessionWindow|writable\(page\) \?/);
  expect(t).toContain('readOnly={!writable(page)}');
  expect(t).toContain('groupId={page.documentId}');
});

it('phone burger lists every EduSport menu link, not only the Strapi nav links, which can come back empty on phones', () => {
  const nav = src('MobileNav.tsx');
  expect(nav).toContain("from './dashboard/menu'");
  for (const k of ['EDUSPORT_LINKS', 'GROUP_ORDER', 'GROUP_LABEL']) expect(nav, k).toContain(k);
  expect(nav).toMatch(/'\/admin' \+ to/);
});

it('group page tab Prezență loads the Prezență styles (month bar, "pz-sub" lines)', () => {
  expect(src('dashboard/grupe/GroupPage.tsx')).toMatch(/PREZENTA_CSS/);
  expect(src('dashboard/grupe/GroupPage.tsx')).toMatch(/<style>\{[^}]*PREZENTA_CSS[^}]*\}<\/style>/);
  expect(src('dashboard/prezenta/styles.ts')).toContain('.pz-sub{display:block');
});

it('lesson delete confirmation has no body strip: ConfirmDialog passes no children without a message', () => {
  const c = src('ConfirmDialog.tsx');
  expect(c).toContain('hasBody');
  expect(c).toContain(') : undefined}');
});

it('option A: day line under the title, one segmented switcher, month and buttons in the page header, date picker after the switcher', () => {
  const screen = src('dashboard/prezenta/PrezentaScreen.tsx');
  expect(screen).toMatch(/subtitle=\{query\.tab === 'sedinte' \? dayLine\(query\.date\)/);
  expect(screen).toContain('pz-head-slot');
  const day = src('dashboard/prezenta/DayTab.tsx');
  expect(day).toContain('<DateInput');
  expect(day.indexOf('<DateInput')).toBeGreaterThan(day.indexOf('<Switcher'));
  expect(day.indexOf('<DateInput')).toBeLessThan(day.indexOf('<Button onClick={onNew}'));
  expect(day).toContain('onDate(v)');
  expect(day).toContain('<Switcher');
  expect(day).toContain('<HeaderSlot');
  for (const f of ['LessonsTab', 'CoachesTab']) expect(src(`dashboard/prezenta/${f}.tsx`), f).toContain('host={host}');
  const sw = src('dashboard/prezenta/Switcher.tsx');
  expect(sw).toContain('createPortal');
  const styles = src('dashboard/prezenta/styles.ts');
  expect(styles).not.toMatch(/dashed|dotted|border-radius:\s*(50%|999)/);
});

it('athlete names are regular weight in the panel and the lessons list', () => {
  expect(src('dashboard/prezenta/SessionPanel.tsx')).not.toMatch(/spv-name[^\n]*row\.name/);
  expect(src('dashboard/prezenta/LessonsTab.tsx')).not.toMatch(/spv-name'\}>\{r\.athleteName/);
  expect(src('dashboard/prezenta/LessonsTab.tsx')).not.toMatch(/'pz-muted' : 'spv-name'/);
});

it('a coach options load failure shows the load-failed notice in both panels', () => {
  const hook = src('dashboard/prezenta/CoachFields.tsx');
  expect(hook).toContain('failed: true');
  for (const f of ['SessionPanel', 'LessonPanel']) {
    const p = src(`dashboard/prezenta/${f}.tsx`);
    expect(p, f).toContain('useCoachOptions');
    expect(p, f).toMatch(/failed \|\| coachesFailed\) && <Notice tone="danger">\{PRESENCE_ERRORS\.loadFailed\}/);
  }
});
