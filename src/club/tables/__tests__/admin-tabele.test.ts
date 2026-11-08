import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ADMIN = join(__dirname, '..', '..', '..', 'admin');
const DASH = join(ADMIN, 'dashboard');
const TABELE = join(DASH, 'sportivi', 'tabele');
const read = (p: string) => readFileSync(join(DASH, p), 'utf8');
const tabeleFiles = (): string[] => (existsSync(TABELE) ? readdirSync(TABELE) : []);
const tabeleSource = () => tabeleFiles().map((f) => readFileSync(join(TABELE, f), 'utf8')).join('\n');
const FILES = ['TabelePage', 'ViewBar', 'Builder', 'ColumnList', 'FilterList', 'ResultTable', 'NewViewModal'].map((f) => `${f}.tsx`).concat(['api.ts', 'styles.ts']);

describe('Tabele screen files', () => {
  it('has every file of the brief', () => {
    for (const f of FILES) expect(tabeleFiles(), f).toContain(f);
  });

  it('SportiviPage renders Tabs with the Tabele tab names, on the list only; no Tabs import in the Tabele files or the list (the record keeps its own tabs)', () => {
    const page = read('SportiviPage.tsx');
    expect(page).toContain('Tabs');
    expect(page).toContain('TABLES_COPY.tabs');
    expect(page).toContain('readTablesQuery(');
    const afterRecord = page.slice(page.indexOf('return id ?'));
    expect(afterRecord).toMatch(/id \? <AthleteRecordPage[^>]*\/> :/);
    const noTabs = [...readdirSync(TABELE).filter((n) => n.endsWith('.tsx')).map((n) => `sportivi/tabele/${n}`), 'sportivi/SportiviList.tsx'];
    for (const f of noTabs) expect(read(f), f).not.toMatch(/import[^;]*\bTabs\b[^;]*from/);
  });

  it('TabelePage wraps in AdminPage (ui-root, SaveBar opt-out) and the new-view modal uses Modal', () => {
    const page = read('sportivi/tabele/TabelePage.tsx');
    expect(page).toContain('<AdminPage');
    expect(page).toContain('Window');
    expect(read('sportivi/tabele/NewViewModal.tsx')).toMatch(/<Modal\b/);
  });

  it('the view bar chooses its buttons with actionsFor and offers the two downloads', () => {
    const bar = read('sportivi/tabele/ViewBar.tsx');
    expect(bar).toContain('actionsFor(');
    expect(bar).toContain('TABLES_COPY.xlsx');
    expect(bar).toContain('TABLES_COPY.csv');
    expect(bar).toContain('TABLES_COPY.readyGroup');
    expect(bar).toContain('TABLES_COPY.savedGroup');
  });

  it('downloads go through downloadPost with the current (effective) definition', () => {
    const src = tabeleSource();
    expect(src).toContain('downloadPost(');
    expect(src).toContain('effectiveDefinition(');
    expect(src).toMatch(/tables\/export/);
    expect(read('inscrieri/downloadPdf.ts')).toMatch(/export const downloadPost = \(token: string \| null, url: string, body: unknown, fallbackName: string, opts: PostOptions = \{\}\)/);
  });

  it('the result table windows large results and opens athletes in a new tab', () => {
    const table = read('sportivi/tabele/ResultTable.tsx');
    expect(table).toContain('windowed(');
    expect(table).toMatch(/AthleteLink|window\.open\(.*'_blank', 'noopener'\)/);
  });

  it('the builder is open on desktop and a BottomSheet on phones; it uses the shared controls', () => {
    const page = read('sportivi/tabele/TabelePage.tsx');
    expect(page).toContain('BottomSheet');
    expect(page).toContain('useIsPhone');
    expect(page).toContain('TABLES_COPY.editMobile');
    const builder = read('sportivi/tabele/Builder.tsx');
    expect(builder).toContain('SegmentedControl');
    expect(builder).toContain('Select');
    expect(read('sportivi/tabele/ColumnList.tsx')).toContain('useDragReorder');
    expect(read('sportivi/tabele/ColumnList.tsx')).toContain('Checkbox');
  });

  it('delete asks first and offers the 8 s undo toast; server errors are shown with their text', () => {
    const src = tabeleSource();
    expect(src).toContain('ConfirmDialog');
    expect(src).toContain('confirmDelete(');
    expect(src).toMatch(/duration: 8000|UNDO_MS/);
    expect(src).toContain('requestErrorText(');
    expect(read('inscrieri/downloadPdf.ts')).toContain('blobErrorText');
  });

  it('notices of a repaired view show above the table, and a broken view cannot be opened', () => {
    const page = read('sportivi/tabele/TabelePage.tsx');
    expect(page).toContain('notices');
    expect(page).toContain('broken');
    expect(page).toContain('TABLES_COPY.brokenView');
  });

  it('the default view is "Plăți pe grupă luna aceasta" (the catalog names it)', () => {
    expect(tabeleSource()).toContain('defaultViewId');
  });

  it('the colour rule covers dashboard/sportivi/tabele', () => {
    const check = readFileSync(join(ADMIN, '..', '..', 'scripts', 'admin-ui-check.mjs'), 'utf8');
    expect(check).toContain("join(ADMIN, 'dashboard', 'sportivi')");
  });

  it('the CSS keeps to tokens: no backtick inside, no dashed or dotted lines, no pills or circles', () => {
    const css = read('sportivi/tabele/styles.ts');
    const body = css.slice(css.indexOf('`') + 1, css.lastIndexOf('`'));
    expect(body).not.toContain('`');
    expect(body).not.toMatch(/dashed|dotted|50%|999px|border-radius:\s*(9|[1-9][0-9])/);
    expect(body).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(/);
    for (const f of tabeleFiles().filter((n) => n.endsWith('.tsx'))) expect(readFileSync(join(TABELE, f), 'utf8'), f).not.toMatch(/dashed|dotted|rounded-full/);
    expect(body).toMatch(/overflow-x:auto/);
  });

  it('on a phone nothing makes the page scroll sideways: the table scrolls in its box with the first column fixed', () => {
    const body = read('sportivi/tabele/styles.ts');
    expect(body).toMatch(/position:sticky;left:0/);
    expect(body).toMatch(/min-width:0/);
    expect(body).toMatch(/@media \(max-width:640px\)/);
  });

  it('no forbidden characters in the screen sources', () => {
    expect(tabeleSource()).not.toMatch(/[—–·„”“]/);
  });

  it('closes the quick filters at 10 builder filters, sends the view name with a download, wraps the subject control on phones and marks sort only on the sorted column', () => {
    const page = read('sportivi/tabele/TabelePage.tsx');
    expect(page).toContain('quickFiltersOpen(');
    expect(page).toMatch(/disabled=\{!open\}/);
    expect(page).toMatch(/api\.download\(format, effective, current\.name,/);
    expect(read('sportivi/tabele/api.ts')).toMatch(/\{ definition, format, name \}/);
    expect(read('sportivi/tabele/api.ts')).toContain('attemptTokenRefresh');
    expect(read('sportivi/tabele/api.ts')).toContain('backendURL');
    expect(read('sportivi/tabele/Builder.tsx')).toContain('tbl-subject');
    expect(read('sportivi/tabele/styles.ts')).toMatch(/\.tbl-subject\.ui-seg\{display:grid;grid-template-columns:repeat\(2,/);
    expect(read('sportivi/tabele/ResultTable.tsx')).toMatch(/\{dir &&[^\n]*ui-table-sort/);
  });
});
