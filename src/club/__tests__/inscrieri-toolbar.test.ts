import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';

const dash = (...p: string[]) => readFileSync(join(__dirname, '..', '..', 'admin', 'dashboard', ...p), 'utf8');
const page = dash('InscrieriPage.tsx');
const table = dash('SubmissionTable.tsx');
const header = dash('inscrieri', 'PanelHeader.tsx');
const panel = dash('inscrieri', 'RegistrationPanel.tsx');

it('Înscrieri opts into the one-row toolbar and keeps "Sportiv existent" inside "Alte filtre"', () => {
  expect(page).toContain('oneRowToolbar: true');
  expect(page).toContain('advancedFilters: <ExistingFilter');
  expect(table).toContain('{extras?.advancedFilters}');
  expect(table).toContain('cfg.oneRowToolbar ? oneRowBar : twoRowBars');
});

it('the one-row bar has the sort tooltip and the columns icon menu with radio items', () => {
  expect(table).toContain('<span className="sbt-sort" title="Sortare">');
  expect(table).toContain('ariaLabel="Coloane"');
  expect(table).toContain('role="menuitemradio"');
});

it('the status Select sits next to the name and the status box is gone from the panel', () => {
  expect(header).toContain('api.statusInline(row)');
  expect(panel).not.toContain('statusBox');
});
