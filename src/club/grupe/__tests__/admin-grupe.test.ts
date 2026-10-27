import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// The admin bundle has no test runner; these read its source.
const SRC = join(__dirname, '..', '..', '..');
const source = (p: string) => readFileSync(join(SRC, p), 'utf8');
const grupe = (f: string) => source(`admin/dashboard/grupe/${f}`);

describe('menu and route (5.1)', () => {
  it('puts "Grupe" above "Sportivi" in Club și școală, on its own plugin route', () => {
    const menu = source('admin/dashboard/menu.tsx');
    expect(menu.indexOf("label: 'Grupe'")).toBeGreaterThan(-1);
    expect(menu.indexOf("label: 'Grupe'")).toBeLessThan(menu.indexOf("label: 'Sportivi'"));
    expect(menu).toContain("import('./GrupePage')");
    expect(source('admin/dashboard/GrupePage.tsx')).toContain('groupIdFromSplat');
  });
});

describe('list page (5.2)', () => {
  const list = grupe('GrupeList.tsx');

  it('has the season select, the section tabs, the count line and the four columns', () => {
    for (const s of ['seasonOptions', 'tabItems', 'countLine', 'GRUPE_COPY.colGroup', 'GRUPE_COPY.colProgram', 'GRUPE_COPY.colCoaches', 'GRUPE_COPY.colMembers']) expect(list, s).toContain(s);
    expect(list).toContain('GRUPE_COPY.noProgram');
    expect(list).toContain('GRUPE_COPY.noCoach');
  });

  it('writes only on a season that is not past (W5) and shows cards on phones', () => {
    expect(list).toContain('writable(page)');
    expect(list).toContain('phoneSummary');
  });
});

describe('group window (5.4, W11)', () => {
  const dialog = grupe('GroupDialog.tsx');

  it('has Nume, Listă de prețuri (optional), Antrenori, Program public with its hint', () => {
    for (const s of ['GRUPE_COPY.fieldName', 'GRUPE_COPY.fieldPriceList', 'GRUPE_COPY.optional', 'GRUPE_COPY.fieldCoaches', 'GRUPE_COPY.fieldPublic', 'GRUPE_COPY.publicHint', 'GRUPE_COPY.create', 'GRUPE_COPY.save']) expect(dialog, s).toContain(s);
  });

  it('toasts "Grupă creată", "Salvat." or "Nicio modificare." and opens the new group on Program', () => {
    for (const s of ['GROUP_TOASTS.created', 'GROUP_TOASTS.saved', 'GROUP_TOASTS.unchanged']) expect(dialog, s).toContain(s);
    expect(grupe('GrupeList.tsx')).toContain("'program')");
  });
});

describe('toasts with "Anulează" (8.1)', () => {
  const undo = grupe('undo.ts');

  it('holds 8 seconds, runs plain async, reloads every open Grupe screen', () => {
    expect(undo).toContain('UNDO_MS = 8000');
    expect(undo).toContain('GROUP_TOASTS.undo');
    expect(undo).toContain('GROUP_TOASTS.undone');
    expect(undo).toContain('grupeChanged()');
  });
});

describe('design rules', () => {
  it('no dashed or dotted lines, no full radius, no backtick in the CSS', () => {
    const css = grupe('styles.ts');
    expect(css).not.toMatch(/dashed|dotted|9999px|50%/);
    expect(css.split('`').length).toBe(3);
  });

  it('the grupe folder is held to the colour rule', () => {
    expect(source('../scripts/admin-ui-check.mjs')).toContain("join(ADMIN, 'dashboard', 'grupe')");
    expect(existsSync(join(SRC, 'admin/dashboard/grupe/PanelShell.tsx'))).toBe(true);
  });
});

describe('"Fără grupă" (5.3)', () => {
  it('is the approved orange: orange outline and ink text, dark orange count, tokens only, flat', () => {
    const css = grupe('styles.ts');
    const rule = (sel: string) => css.split('\n').filter((l) => l.includes(sel)).join('\n');
    const btn = rule('.ui-btn.grp-unassigned');
    expect(btn).toContain('border-color:var(--theme-cat-eveniment)');
    expect(btn).toContain('color:var(--theme-cat-eveniment-soft-fg)');
    expect(btn).toContain(':hover:not(:disabled)');
    const count = rule('.grp-count{');
    expect(count).toContain('background:var(--theme-cat-eveniment-soft-fg)');
    expect(count).toContain('color:var(--theme-cat-eveniment-soft)');
    for (const r of [btn, count]) expect(r).not.toMatch(/#[0-9a-f]{3,8}\b|box-shadow|border-radius:(?!var\(--ui-radius-sm\))/i);
  });

  const button = grupe('UnassignedButton.tsx');

  it('is hidden at 0, shows the orange count, opens a dropdown or a sheet with the rows', () => {
    expect(button).toContain('count === 0');
    expect(button).toContain('grp-count');
    expect(button).toContain('grp-unassigned');
    expect(button).toContain('desktop="dropdown"');
    expect(button).toContain('GRUPE_COPY.unassignedHeader');
  });

  it('preselects the proposal, allocates one or all, toasts with undo', () => {
    for (const s of ['initialPicks', 'GRUPE_COPY.pickGroup', 'GRUPE_COPY.allocate', 'GRUPE_COPY.allocateAll', 'allocateItems', "mode: 'allocate'", 'GROUP_TOASTS.allocated', 'GROUP_TOASTS.allocatedAll', 'undoToast']) {
      expect(button, s).toContain(s);
    }
  });

  it('keeps a button busy until the answer', () => {
    expect(button).toContain('loading=');
  });

  it('the list page shows it next to "Grupă nouă" on a writable season', () => {
    expect(grupe('GrupeList.tsx')).toContain('<UnassignedButton');
  });
});

describe('group page (6.1, 6.2, 6.4)', () => {
  const page = grupe('GroupPage.tsx');
  const roster = grupe('RosterTab.tsx');
  const move = grupe('MoveDialog.tsx');
  const add = grupe('AddMembers.tsx');
  const menu = grupe('GroupMenu.tsx');

  it('header: back to Grupe, subtitle, "..." with Editează / Șterge grupa, read-only on a past season', () => {
    expect(page).toContain('GRUPE_COPY.back');
    expect(page).toContain('subtitle(page)');
    expect(page).toContain('writable(page)');
    for (const s of ['GRUPE_COPY.edit', 'GRUPE_COPY.remove', 'GRUPE_COPY.removeConfirm', 'page.deletable', 'GROUP_TOASTS.deleted']) expect(menu, s).toContain(s);
  });

  it('roster: the four columns, the athlete opens in the same tab, cards on phones, "..." per row', () => {
    for (const s of ['GRUPE_COPY.colAthlete', 'GRUPE_COPY.colAge', 'GRUPE_COPY.colMain', 'GRUPE_COPY.colOthers', 'GRUPE_COPY.none', 'athleteRecordTo', 'phoneMemberLine', '<MemberMenu']) expect(roster, s).toContain(s);
    expect(roster).not.toContain('target="_blank"');
    expect(grupe('MemberMenu.tsx')).toContain('memberMenuItems');
  });

  it('the move window: Sportiv, Din, În with "Alege grupa", no abonament in phase 4', () => {
    for (const s of ['GRUPE_COPY.moveTitle', 'GRUPE_COPY.addAlsoTitle', 'GRUPE_COPY.fieldAthlete', 'GRUPE_COPY.fieldFrom', 'GRUPE_COPY.fieldTo', 'GRUPE_COPY.pickGroup', 'GROUP_TOASTS.moved', 'GROUP_TOASTS.addedAlso', 'undoToast']) expect(move, s).toContain(s);
    expect(move).not.toMatch(/[Aa]bonament/);
  });

  it('"Scoate din grupă" has no window and toasts with undo', () => {
    expect(roster).toContain('GROUP_TOASTS.removed');
    expect(roster).toContain('api.removeMember');
  });

  it('"Adaugă sportivi": Fără grupă first, all athletes on the switch, members hidden, several ticked', () => {
    for (const s of ['GRUPE_COPY.addMembers', 'GRUPE_COPY.allAthletes', 'GRUPE_COPY.addToGroup', 'addCandidates', 'api.unassigned', 'api.searchAthletes', "mode: 'add'", 'GROUP_TOASTS.added']) expect(add, s).toContain(s);
  });

  it('Istoric reads the group history, newest first', () => {
    expect(grupe('GroupHistoryTab.tsx')).toContain('api.history');
    expect(grupe('GroupHistoryTab.tsx')).toContain('historyWhen');
  });
});

describe('Program tab (6.3)', () => {
  const tab = grupe('ProgramTab.tsx');
  const drawer = grupe('ProgramDrawer.tsx');
  const panel = grupe('DatePanel.tsx');
  const cal = grupe('GroupCalendar.tsx');
  const view = source('plugins/component-preview/admin/src/calendar/CalendarView.tsx');

  it('Program obișnuit rows with Schimbă, and Adaugă program, on a writable season', () => {
    for (const s of ['GRUPE_COPY.usual', 'GRUPE_COPY.change', 'GRUPE_COPY.addProgram', 'GRUPE_COPY.fromDate', 'writable(page)']) expect(tab, s).toContain(s);
  });

  it('the calendar: Listă / Lună, month navigation, Azi, group chips, week titles, no add buttons', () => {
    for (const s of ['GRUPE_COPY.viewList', 'GRUPE_COPY.viewMonth', 'GRUPE_COPY.today', 'groupChip', 'weekTitle', 'api.occurrences']) expect(cal, s).toContain(s);
    expect(cal).not.toContain('onAddOn=');
    expect(view).toContain('view = occView');
    expect(view).toContain('weekTitle = weekLabel');
  });

  it('Program nou: Se repetă, Cât de des, Săptămâna din lună for Lunar, square day toggles, De la, Durată, Se aplică din; off: Data, Notă', () => {
    for (const s of ['GRUPE_COPY.repeat', 'GRUPE_COPY.howOften', 'GRUPE_COPY.weekOfMonth', 'DAY_TOGGLES', 'aria-pressed', 'GRUPE_COPY.startAt', 'GRUPE_COPY.duration', 'GRUPE_COPY.appliesFrom', 'GRUPE_COPY.date', 'GRUPE_COPY.note', 'durationOptions']) expect(drawer, s).toContain(s);
  });

  it('Schimbă programul: no Se repetă, a red Șterge programul with its confirmation', () => {
    for (const s of ['GRUPE_COPY.drawerChange', 'GRUPE_COPY.endProgram', 'GRUPE_COPY.endConfirm', 'grp-danger-link', 'SCHEDULE_TOASTS.programChanged', 'SCHEDULE_TOASTS.programEnded']) expect(drawer, s).toContain(s);
  });

  it('the date panel: Ține / Anulează / Mută, Data nouă and De la for Mută, Motiv, the e-mail box, Șterge ședința for one class, read-only on a break', () => {
    for (const s of ['GRUPE_COPY.thisDate', 'GRUPE_COPY.keep', 'GRUPE_COPY.cancelDate', 'GRUPE_COPY.moveDate', 'GRUPE_COPY.newDate', 'GRUPE_COPY.reason', 'GRUPE_COPY.notify', 'GRUPE_COPY.deleteClass', 'GRUPE_COPY.breakNotice', 'isBreak', 'dateKey', 'dateToast', 'panelTitle']) expect(panel, s).toContain(s);
    expect(panel).toContain('maxLength={120}');
  });

  it('the group page shows the Program tab', () => {
    expect(grupe('GroupPage.tsx')).toContain('<ProgramTab');
  });
});

describe('final review fixes (4-5 final)', () => {
  it('1: the desktop drawer body is padded by the shared body class', () => {
    expect(grupe('PanelShell.tsx')).toContain('bodyClassName="ui-body"');
  });

  it('2: "Șterge ședința" follows the event of the date, not the running series', () => {
    const tab = grupe('ProgramTab.tsx');
    expect(tab).toContain('isOneOffClass(date)');
    expect(tab).not.toContain('program.series.some');
    expect(source('api/calendar-event/services/expand.ts')).toContain("oneOff: ev.recurrence.freq === 'none'");
  });

  it('3: the phone rule targets the real select root and lays name / select + button', () => {
    const css = grupe('styles.ts');
    expect(css).toContain('.grp-ua-row .ui-cbx');
    expect(css).not.toContain('.ui-combo');
    expect(css).toContain('.grp-ua-row .ui-btn{grid-column:2;grid-row:2}');
  });

  it('4: load failures show the existing text; a failed program never offers "Adaugă program"', () => {
    for (const f of ['ProgramTab.tsx', 'GroupCalendar.tsx', 'GroupDialog.tsx', 'MoveDialog.tsx', 'AddMembers.tsx']) expect(grupe(f), f).toContain('GROUP_ERRORS.loadFailed');
    const tab = grupe('ProgramTab.tsx');
    expect(tab.indexOf('if (failed)')).toBeGreaterThan(-1);
    expect(tab.indexOf('if (failed)')).toBeLessThan(tab.indexOf('<Usual'));
    expect(tab).not.toContain('series: []');
  });

  it('5: nothing written shows the stale error, never the success toast; the "În" list skips own groups', () => {
    expect(grupe('undo.ts')).toContain('GROUP_ERRORS.stale');
    expect(grupe('UnassignedButton.tsx')).toMatch(/wroteNothing\(res\.data\)\) return staleToast\(\);\s*undoToast\(GROUP_TOASTS\.allocated\(/);
    expect(grupe('MoveDialog.tsx')).toMatch(/wroteNothing\(res\.data\)\) return staleToast\(\);\s*undoToast\(GROUP_TOASTS\.addedAlso/);
    expect(grupe('MoveDialog.tsx')).toContain('joinableGroups(groups, p.page.documentId, p.member.others)');
  });

  it('minors: no self-reopening dropdown, Istoric refreshes, one fetch per action, labelled selects', () => {
    expect(grupe('UnassignedButton.tsx')).toMatch(/if \(count === 0\) setOpen\(false\)/);
    expect(grupe('GroupHistoryTab.tsx')).toContain('useGrupeRefresh(load)');
    expect(grupe('ProgramTab.tsx')).toContain("const season = page.season?.label ?? null;");
    expect(grupe('ProgramTab.tsx')).not.toMatch(/\[api, page\.documentId, page\.season\]/);
    expect(grupe('UnassignedButton.tsx')).toContain('aria-label={`${GRUPE_COPY.pickGroup}: ${row.name}`}');
    expect(grupe('MoveDialog.tsx')).toContain('aria-label={GRUPE_COPY.fieldTo}');
  });
});
