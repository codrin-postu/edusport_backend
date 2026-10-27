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
