import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = join(__dirname, '..', '..');
const source = (p: string) => readFileSync(join(SRC, p), 'utf8');

describe('Calendar și serii (7.1, 7.3)', () => {
  const page = source('admin/dashboard/ProgramEditPage.tsx');
  const section = source('admin/dashboard/program/PauzeSection.tsx');
  const dialog = source('admin/dashboard/program/BreakDialog.tsx');

  it('Pauze comes first, then the Calendar; the "Serii de cursuri" editor and its save bar are gone', () => {
    expect(page.indexOf('<PauzeSection')).toBeGreaterThan(-1);
    expect(page.indexOf('<PauzeSection')).toBeLessThan(page.indexOf('<ProgramOverviewEditor'));
    expect(page).not.toMatch(/ScheduleGroupsInner|Serii de cursuri|<SaveBar/);
  });

  it('the section: Adaugă pauză, Nume / De la / Până la, Editează and a red Șterge with its confirmation, cards on phones', () => {
    for (const s of ['PAUZE_COPY.add', 'PAUZE_COPY.colName', 'PAUZE_COPY.colFrom', 'PAUZE_COPY.colTo', 'PAUZE_COPY.edit', 'PAUZE_COPY.remove', 'PAUZE_COPY.removeConfirm', 'breakRows', 'breakPhoneLine', 'spv-danger']) expect(section, s).toContain(s);
  });

  it('the window: Nume, De la, Până la, the hint, Anulează / Salvează, the date order checked first, toasts', () => {
    for (const s of ['PAUZE_COPY.windowNew', 'PAUZE_COPY.windowEdit', 'PAUZE_COPY.hint', 'breakFormError', 'SCHEDULE_TOASTS.breakSaved', 'loading=']) expect(dialog, s).toContain(s);
    expect(section).toContain('SCHEDULE_TOASTS.breakDeleted');
  });
});

describe('empty group tabs (10.6, W31)', () => {
  const roster = source('admin/dashboard/grupe/RosterTab.tsx');
  const program = source('admin/dashboard/grupe/ProgramTab.tsx');

  it('Sportivi: "Niciun sportiv în <sezon>.", "Copiază sportivii din <sezon>", the hint, the toast with undo', () => {
    for (const s of ['page.copyFrom', 'NEW_SEASON_COPY.emptyMembers', 'NEW_SEASON_COPY.copyMembers', 'NEW_SEASON_COPY.copyMembersHint', 'NEW_SEASON_COPY.membersCopiedToast', 'api.copyMembers', 'writable(page)']) expect(roster, s).toContain(s);
  });

  it('Program: "Niciun program în <sezon>.", "Copiază programul din <sezon>" beside "Adaugă program", the hint, the toast', () => {
    for (const s of ['page.copyFrom', 'NEW_SEASON_COPY.emptyProgram', 'NEW_SEASON_COPY.copyProgram', 'NEW_SEASON_COPY.copyProgramHint', 'NEW_SEASON_COPY.programCopiedToast', 'api.copyProgram']) expect(program, s).toContain(s);
  });
});

describe('the general calendar (7.2, W18)', () => {
  const editor = source('plugins/component-preview/admin/src/ProgramOverviewEditor.tsx');
  const model = source('plugins/component-preview/admin/src/calendar/model.ts');
  const drawer = source('plugins/component-preview/admin/src/calendar/EventDrawer.tsx');

  it('reads the admin occurrences route, so non-public groups show too', () => {
    expect(editor).toContain('/api/club/calendar/occurrences');
    expect(editor).not.toContain("fetch(`/api/calendar/occurrences");
  });

  it('group events read "<ora> <grupă>" and open the group date panel with "Deschide grupa"', () => {
    expect(model).toContain('o.groupName');
    expect(editor).toContain('<DatePanel');
    expect(editor).toContain('groupPageTo');
    expect(editor).toContain('o.groupId');
  });

  it('new events no longer offer "Școala de patinaj"', () => {
    expect(model).toContain('NEW_EVENT_CATEGORY_OPTIONS');
    expect(drawer).toContain('NEW_EVENT_CATEGORY_OPTIONS');
  });
});

describe('new season (10.1, 10.2, 10.5)', () => {
  const page = source('admin/pages/SezoanePage.tsx');
  const dialog = source('admin/pages/sezoane/NewSeasonDialog.tsx');
  const steps = source('admin/pages/sezoane/NewSeasonSteps.tsx');

  it('the button shows on the next season only and its click does not open the row', () => {
    expect(page).toContain('startableLabel');
    expect(page).toContain('NEW_SEASON_COPY.button');
    expect(page).toContain('stopPropagation');
  });

  it('three steps with their buttons; the last applies with a busy button', () => {
    for (const s of ['NEW_SEASON_COPY.stepOf', 'NEW_SEASON_COPY.next', 'NEW_SEASON_COPY.back', 'NEW_SEASON_COPY.apply', 'NEW_SEASON_COPY.cancel', 'loading=']) expect(dialog, s).toContain(s);
  });

  it('step 1 rows, step 2 tables with header ticks and children, step 3 tiles, lines and warning', () => {
    for (const s of ['step1Rows', 'NEW_SEASON_COPY.onSite', 'NEW_SEASON_COPY.inPanel', 'headerState', 'indeterminate', 'NEW_SEASON_COPY.seeAthletes', 'childMain', 'NEW_SEASON_COPY.mainRule', 'StatTile', 'preview.lines', 'preview.warning', 'preview.summary']) {
      expect(steps, s).toContain(s);
    }
  });

  it('after applying: Grupe on the new season and the toast with "Anulează"', () => {
    expect(dialog).toContain('grupeListTo');
    expect(dialog).toContain('undoToast');
  });
});
