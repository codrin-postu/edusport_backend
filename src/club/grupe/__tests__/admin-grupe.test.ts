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
