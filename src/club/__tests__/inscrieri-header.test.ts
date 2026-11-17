import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';

const dash = (...p: string[]) => readFileSync(join(__dirname, '..', '..', 'admin', 'dashboard', ...p), 'utf8');
const page = dash('InscrieriPage.tsx');
const table = dash('SubmissionTable.tsx');
const forms = dash('inscrieri', 'BlankFormsMenu.tsx');

it('Înscrieri opts into the compact header and puts the blank forms in Export', () => {
  expect(page).toContain('compactHeader: true');
  expect(page).toContain('exportExtras: (close) => <BlankFormItems close={close} />');
  expect(page).not.toContain('headerActions');
  expect(page).not.toContain('statSuffix');
});

it('lists the two blank forms after a separator and a group label, with a download icon', () => {
  expect(forms).toContain('<div className="sbt-sep" />');
  expect(forms).toContain('<div className="sbt-grp">Formulare goale</div>');
  expect(forms).toContain("const BLANK_KINDS: PanelDocumentKind[] = ['acord', 'adeziune'];");
  expect(forms).toContain('<IconDownload />');
  expect(forms).toContain('{DOCUMENT_LABELS[kind]} (PDF)');
  expect(forms).toContain('Formularul nu a putut fi descărcat.');
  expect(table).toContain('{cfg.exportExtras?.(() => setExportOpen(false))}');
});

it('shows a "N noi" tag by the title that filters to Nou and hides at zero', () => {
  expect(table).toContain('noiCount > 0 &&');
  expect(table).toContain('title="Fără arhivate"');
  expect(table).toContain("onClick={() => showOnly('status', 'Nou')}");
  expect(table).toContain('{noiCount} noi');
  expect(table).toContain('<PageHeader title={headerTitle} actions={statActions} />');
});

it('drops the stat block in the compact header', () => {
  expect(table).toContain('{!cfg.compactHeader && (\n        <div className="sbt-stat">');
});

it('moves "Mută tot sezonul..." into a "..." page menu after the Sezon select', () => {
  expect(table).toContain('title="Mai multe acțiuni"');
  expect(table).toContain('chevron={false}');
  const season = table.indexOf('aria-label="Sezon"');
  const menu = table.indexOf('{seasonButton}');
  expect(season).toBeGreaterThan(0);
  expect(menu).toBeGreaterThan(season);
  expect(table).not.toContain('{cfg.headerActions}');
});
