import { readdirSync, readFileSync } from 'node:fs';
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
  for (const p of ['/attendance/period', '/attendance/grid', '/attendance/session/defaults', '/attendance/session/check', '/attendance/session', '/attendance/coaches', 'coaches.csv',
    '/lessons/new', '/lessons', '/attendance', '/groups/options', '/undo']) expect(api, p).toContain(p);
  expect(api).not.toContain('/attendance/day');
});

it('undo toasts last 8 s with "Anulează" and no X', () => {
  const undo = src('dashboard/prezenta/undo.ts');
  expect(undo).toContain('UNDO_MS = 8000');
  expect(undo).toMatch(/duration: UNDO_MS, action: \{ label: MONEY_UI_COPY\.undo\.action/);
});

it('Setări site has "Prezență și plăți din" with its hint (3.8, 5.16)', () => {
  const page = src('pages/SetariSitePage.tsx');
  expect(page).toContain('SETARI_COPY.attendanceStart');
  expect(page).toContain('SETARI_COPY.attendanceStartHint');
  expect(page).toContain('attendanceStartDate');
});

it('the shells carry their titles (Plăți is built since 5-6 T3, Abonamente since T4, De încasat since T5)', () => {
  expect(src('dashboard/AbonamentePage.tsx')).toContain('AbonamenteList');
  expect(src('dashboard/PlatiPage.tsx')).toContain('PlatiList');
  expect(src('dashboard/DeIncasatPage.tsx')).toContain('DeIncasatList');
});

it('prezenta components are held to the colour rule', () => {
  expect(readFileSync(join(ROOT, 'scripts/admin-ui-check.mjs'), 'utf8')).toContain("'dashboard', 'prezenta'");
});

it('Prezență: no tabs, view and picker, Listă / Grilă only for Grupe outside Zi, notices (5.1, S37)', () => {
  const s = src('dashboard/prezenta/PrezentaScreen.tsx');
  expect(s).not.toMatch(/\bTabs\b/);
  expect(s).toContain('SegmentedControl');
  expect(s).toContain('PERIOD_COPY.show[v]');
  expect(s).toMatch(/query\.show === 'grupe' && query\.view !== 'zi'/);
  expect(s).toMatch(/\{gridOn && <SegmentedControl/);
  expect(s).toContain('PeriodHeader');
  expect(s).toContain('startNotice');
  expect(s).toContain('noPriceListNotice(');
  const h = src('dashboard/prezenta/PeriodHeader.tsx');
  expect(h).toContain('<Select');
  expect(h).toContain('type="date"');
  expect(h.indexOf('<Select')).toBeLessThan(h.indexOf('<Switcher'));
  expect(h.indexOf('<Switcher')).toBeLessThan(h.indexOf('PERIOD_COPY.today'));
});
it('Grupe, Listă: undone section above the days, day headers, states, month scroll, phone cards (5.1)', () => {
  const d = src('dashboard/prezenta/GroupsList.tsx');
  expect(d.indexOf('PERIOD_COPY.undoneTitle(')).toBeLessThan(d.indexOf('groups={dayGroups(page'));
  for (const f of ['dayHeader(', 'STATE_COPY', 'PERIOD_COPY.undoneTitle(', 'scrollTarget(', 'PERIOD_COPY.outside', 'PERIOD_COPY.newSession']) expect(d, f).toContain(f);
  for (const k of ['colDate', 'colTime', 'colGroup', 'colCoach', 'colState', 'colPresent']) expect(d, k).toContain(`PREZENTA_COPY.${k}`);
  expect(d).toMatch(/page\.undone\.length > 0/);
  expect(d).toContain("view === 'zi' ? null");
  const t = src('dashboard/prezenta/PeriodTable.tsx');
  expect(t).toContain('spv-cards');
  expect(t).toContain('pz-dayrow');
});
it('Grupe, Grilă: five steps, sticky group column, a cell opens that day (5.1, S42)', () => {
  const g = src('dashboard/prezenta/GroupsGrid.tsx');
  for (const f of ['cellStep(', 'cellText(', 'GRID_COPY.legendWeek', 'GRID_COPY.legendMonth']) expect(g, f).toContain(f);
  expect(g).toContain("onQuery({ view: 'zi', date: c.date, show: 'grupe' })");
  expect(src('dashboard/prezenta/styles.ts')).toMatch(/\.pz-grid th\.pz-grid-group\{position:sticky/);
  expect(src('dashboard/prezenta/styles.ts').match(/border-radius:[^;}]*/g)?.every((r) => /var\(--ui-radius-/.test(r))).toBe(true);
});
it('no dashed, dotted or round shapes under dashboard/prezenta', () => {
  const dir = join(ADMIN, 'dashboard', 'prezenta');
  for (const f of readdirSync(dir)) expect(readFileSync(join(dir, f), 'utf8'), f).not.toMatch(/dashed|dotted|border-radius:\s*50%/);
});
it('the page reads the new address; the coach rows open the coach page', () => {
  expect(src('dashboard/PrezentaPage.tsx')).toContain('readPrezentaQuery');
  expect(src('dashboard/prezenta/CoachesList.tsx')).toContain('coachPageTo(');
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
  for (const f of ['panelTitleSuffix(', 'longDayTitle(', 'columnsFor(', 'footerText(', 'savedLine', 'initialTicks(', 'saveBody(']) expect(p, f).toContain(f);
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

it('Lecții individuale: day headers, columns, empty, cards (5.1)', () => {
  const t = src('dashboard/prezenta/LessonsList.tsx');
  for (const k of ['colTime', 'colAthlete', 'colCoach', 'colState']) expect(t, k).toContain(`PREZENTA_COPY.${k}`);
  for (const k of ['newLesson', 'emptyLessons']) expect(t, k).toContain(`PERIOD_COPY.${k}`);
  expect(t).toContain('dayHeader(');
  expect(t).toContain('present === false');
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
it('Antrenori: columns, CSV by period, empty (5.1)', () => {
  const c = src('dashboard/prezenta/CoachesList.tsx');
  for (const k of ['colCoach', 'colGroupSessions', 'colLessons', 'colHours']) expect(c, k).toContain(`PREZENTA_COPY.${k}`);
  for (const k of ['exportCsv', 'emptyCoaches']) expect(c, k).toContain(`PERIOD_COPY.${k}`);
  expect(c).toContain('api.coachesCsv(period.from, period.to)');
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

it('the period header sits in the bar; the action goes to the page header slot', () => {
  const screen = src('dashboard/prezenta/PrezentaScreen.tsx');
  expect(screen).toContain('periodLabel(');
  expect(screen).toContain('pz-head-slot');
  for (const f of ['GroupsList', 'GroupsGrid', 'LessonsList', 'CoachesList']) expect(src(`dashboard/prezenta/${f}.tsx`), f).toContain('<HeaderSlot host={host}>');
  const sw = src('dashboard/prezenta/Switcher.tsx');
  expect(sw).toContain('createPortal');
  const styles = src('dashboard/prezenta/styles.ts');
  expect(styles).not.toMatch(/dashed|dotted|border-radius:\s*(50%|999)/);
});

it('athlete names are regular weight in the panel and the lessons list', () => {
  expect(src('dashboard/prezenta/SessionPanel.tsx')).not.toMatch(/spv-name[^\n]*row\.name/);
  expect(src('dashboard/prezenta/LessonsList.tsx')).not.toMatch(/spv-name'\}>\{r\.athleteName/);
  expect(src('dashboard/prezenta/LessonsList.tsx')).not.toMatch(/'pz-muted' : 'spv-name'/);
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

it('the panels link coaches, the group and athletes (11-2 T4, S36, S43, S44)', () => {
  const session = src('dashboard/prezenta/SessionPanel.tsx');
  const lesson = src('dashboard/prezenta/LessonPanel.tsx');
  const links = src('dashboard/prezenta/PanelLinks.tsx');
  expect(session.indexOf('<CoachLinks')).toBeGreaterThan(0);
  expect(session.indexOf('<CoachLinks')).toBeLessThan(session.indexOf('<CoachFields'));
  expect(session).toContain('groupPageTo(');
  expect(session).toContain('PANEL_LINKS.openGroup');
  expect(session).toContain('highlightAthleteId');
  expect(session).toContain('scrollIntoView');
  expect(session).toContain('<AthleteLink');
  expect(session).not.toMatch(/<span>\{row\.name\}<\/span>/);
  expect(lesson).toContain('<AthleteLink');
  expect(lesson).not.toContain('label={lesson.athleteName}');
  const [coachLinks, athleteLink] = links.split('export function AthleteLink');
  expect(athleteLink).toContain('target="_blank"');
  expect(athleteLink).toContain('rel="noopener"');
  expect(coachLinks).not.toMatch(/target=|rel=/);
  expect(coachLinks).toContain('coachPageTo(');
  expect(coachLinks).toContain('<FollowLink');
  expect(links).toContain('PANEL_LINKS.coaches');
  expect(src('dashboard/prezenta/api.ts')).toMatch(/athlete/);
  for (const f of ['SessionPanel.tsx', 'LessonPanel.tsx', 'PanelLinks.tsx', 'styles.ts']) expect(src(`dashboard/prezenta/${f}`), f).not.toMatch(/dashed|dotted/);
});

it('same-tab panel links go through the unsaved-changes guard (11-2 final F1, F2)', () => {
  const links = src('dashboard/prezenta/PanelLinks.tsx');
  expect(links).toContain('e.preventDefault()');
  expect(links).toContain('if (dirty) setPending(to)');
  expect(links).toContain('location.state');
  for (const f of ['SessionPanel.tsx', 'LessonPanel.tsx']) {
    const p = src(`dashboard/prezenta/${f}`);
    expect(p, f).toContain('useFollow(dirty');
    expect(p, f).toContain('{followDialog}');
    expect(p, f).not.toMatch(/<Link\b/);
  }
  expect(src('dashboard/prezenta/SessionPanel.tsx')).toContain('<FollowLink className="pz-link"');
  expect(src('dashboard/prezenta/CoachPage.tsx')).toMatch(/\{!error && \(\s*<div className="pz-bar">/);
});

it('the coach page (11-2 T5, 5.3): segmented picker, tiles, header, CSV, back, no tabs', () => {
  const page = src('dashboard/prezenta/CoachPage.tsx');
  expect(page).not.toMatch(/\bTabs\b/);
  for (const k of ['SegmentedControl', 'StatTile', 'PeriodHeader', 'COACH_COPY.back', 'backTarget(', 'readCoachQuery(', 'api.coachCsv(', 'api.coachPage(', 'SessionPanel', 'LessonPanel', 'AthleteLink', 'groupPageTo(', 'COACH_COPY.total', 'COACH_COPY.emptySessions', 'COACH_COPY.emptyLessons', 'COACH_COPY.emptyHours', 'PERIOD_COPY.exportCsv', 'useIsPhone']) {
    expect(page, k).toContain(k);
  }
  const api = src('dashboard/prezenta/api.ts');
  expect(api).toMatch(/downloadGet\([\s\S]*?presence\.csv/);
  expect(api).toContain('coachCsv:');
  expect(src('dashboard/PrezentaPage.tsx')).toMatch(/coachIdFromSplat\(/);
  expect(src('dashboard/PrezentaPage.tsx')).toContain('<CoachPage');
  expect(src('dashboard/prezenta/CoachesList.tsx')).toMatch(/coachPageTo\([^)]*\), \{ state: \{ from/);
  expect(page).not.toMatch(/dashed|dotted|border-radius:\s*50%/);
});
