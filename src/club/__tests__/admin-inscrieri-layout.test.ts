import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';

// The admin bundle has no test runner; these read its source.
const admin = join(__dirname, '..', '..', 'admin');
const read = (...p: string[]) => readFileSync(join(admin, ...p), 'utf8');
const ui = read('ui', 'styles.ts');
const table = read('dashboard', 'SubmissionTable.tsx');
const insCss = read('dashboard', 'inscrieri', 'styles.ts');
const docs = read('dashboard', 'inscrieri', 'RegistrationDocuments.tsx');
const pdf = read('dashboard', 'inscrieri', 'downloadPdf.ts');

it('fit page: desktop only, height of the Strapi scroll box, the window fills the rest', () => {
  expect(ui).toContain("export const FIT_PAGE_MEDIA = '@media (min-width:1100px) and (min-height:700px)';");
  expect(ui).toContain("const FP = '.ui-root.ui-page--fit';");
  expect(ui).toContain('${FIT_PAGE_MEDIA}{\n${FP}{height:100%;box-sizing:border-box}');
  expect(ui).toContain('${FP} > .ui-win{flex:1 1 auto;min-height:0;display:flex;flex-direction:column}');
  expect(ui).toContain('${FP} > .ui-win > *{flex:none}');
  expect(ui).toContain('${FP} .ui-win > .ui-table-wrap{flex:1 1 auto;min-height:0;overflow:auto}');
  expect(ui).toContain(
    '${FP} .ui-table-wrap thead th{position:sticky;top:0;z-index:2;background:var(--theme-surface);border-bottom:0;box-shadow:inset 0 -1px 0 var(--theme-border)}',
  );
  const fitBlock = ui.slice(ui.indexOf('${FIT_PAGE_MEDIA}{'), ui.indexOf('\n}\n', ui.indexOf('${FIT_PAGE_MEDIA}{')));
  expect(fitBlock).not.toMatch(/vh|dashed|dotted/);
  expect(read('ui', 'AdminPage.tsx')).toContain("fit && 'ui-page--fit'");
});

it('only Înscrieri and Sportivi opt in; Voluntari and the athlete record keep the scrolling page', () => {
  expect(read('dashboard', 'InscrieriPage.tsx')).toContain('  fitPage: true,\n');
  expect(table).toContain('<AdminPage fit={cfg.fitPage}>');
  expect(read('dashboard', 'VoluntariPage.tsx')).not.toContain('fitPage');
  expect(read('dashboard', 'sportivi', 'SportiviList.tsx')).toContain('<AdminPage fit>');
  expect(read('dashboard', 'sportivi', 'AthleteRecordPage.tsx')).not.toMatch(/<AdminPage fit/);
});

it('Înscrieri: the list box scrolls, the pager stays, the panel body scrolls between fixed parts', () => {
  for (const rule of [
    '.ui-root.ui-page--fit .ui-win > .sbt-listbody{flex:1 1 auto;min-height:0;display:flex;flex-direction:column}',
    '.ui-root.ui-page--fit .sbt-listbody > .sbt-split,.ui-root.ui-page--fit .sbt-listbody > .sbt-sheetwrap{flex:1 1 auto;min-height:0}',
    '.ui-root.ui-page--fit .sbt-split{grid-template-rows:minmax(0,1fr)}',
    '.ui-root.ui-page--fit .sbt-split > .ui-table-wrap,.ui-root.ui-page--fit .sbt-sheetwrap{overflow:auto}',
    '.ui-root.ui-page--fit .sbt-panel{display:flex;flex-direction:column;min-height:0;overflow-y:auto}',
    '.ui-root.ui-page--fit .sbt-panel .sbt-pb{flex:1 1 auto;max-height:none;min-height:0}',
  ]) expect(table).toContain(rule);
  expect(table).toContain('.ui-root .sbt-mws{display:flex;flex-direction:column;gap:12px}\n${FIT_PAGE_MEDIA}{');
  expect(insCss).toContain("FIT_PAGE_MEDIA + '{' +");
  expect(insCss).toContain('.ui-root.ui-page--fit .sbt-panel > .ins-panel{flex:1 1 auto;min-height:0}');
  expect(insCss).toContain('.ui-root.ui-page--fit .ins-panel > .sbt-pb{flex:1 1 auto}}');
  expect(insCss).toContain('FIT_CSS, DOCS_CSS');
});

it('Înscrieri, short desktop window: the panel scrolls as one, header and footer sticky', () => {
  expect(insCss).toContain("FIT_PAGE_MEDIA + ' and (max-height:860px){' +");
  for (const rule of [
    '.ui-root.ui-page--fit .sbt-panel > .ins-panel{overflow:auto}',
    '.ui-root.ui-page--fit .ins-panel > .sbt-pb{flex:1 0 auto;overflow:visible}',
    '.ui-root.ui-page--fit .ins-panel > .ins-ph{position:sticky;top:0;z-index:3;padding-bottom:10px;border-bottom:1px solid var(--theme-border);background:var(--theme-surface-subtle)}',
    '.ui-root.ui-page--fit .ins-panel > .sbt-pa{position:sticky;bottom:0;z-index:3;background:var(--theme-surface-subtle)}}',
  ]) expect(insCss).toContain(rule);
});

it('Documente: each PDF a row with "Vezi" and "Descarcă", names unique, one shared viewPdf', () => {
  expect(docs).toContain("import { downloadPdf, registrationDocumentUrl, viewPdf } from './downloadPdf';");
  expect(docs).toContain('const failed = () => adminToast.error(RECORD_COPY.documentFailed);');
  expect(docs).toContain('<span className="ui-sr"> {label}</span>');
  expect(docs).toContain('onClick={() => void viewPdf(get, url).catch(failed)}>{RECORD_COPY.view}{hidden}</Button>');
  expect(docs).toContain('onClick={() => void downloadPdf(get, url, `${kind}.pdf`).catch(failed)}>{RECORD_COPY.download}{hidden}</Button>');
  expect(docs).toContain('<DocumentRow key={kind} documentId={row.documentId} kind={kind} get={get} />');
  expect(insCss).toContain('.ui-root .ins-doc{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:8px 0;border-bottom:1px solid var(--theme-border)}');
  expect(pdf).toContain('export async function viewPdf(get: Get, url: string): Promise<void> {');
  expect(pdf).toContain("if (!tab) throw new Error('popup blocked');");
  expect(existsSync(join(admin, 'dashboard', 'sportivi', 'openPdf.ts'))).toBe(false);
});
