import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { eduLinkHref } from '../admin-href';
import { athleteRecordTo } from '../sportivi/routes';

describe('Tabele result opens the athlete record by the name only', () => {
  const table = readFileSync('src/admin/dashboard/sportivi/tabele/ResultTable.tsx', 'utf8');

  it('the name is a link to the admin address, not the bare router path, in a new tab', () => {
    expect(table).toContain('href={eduLinkHref(athleteRecordTo(id))} target="_blank" rel="noopener"');
    expect(table).not.toContain('window.open');
  });

  it('the row has no click or key handler and no pointer cursor, only a hover highlight', () => {
    expect(table).not.toMatch(/onClick=\{id|onKeyDown|tabIndex|tbl-click/);
    const css = readFileSync('src/admin/dashboard/sportivi/tabele/styles.ts', 'utf8');
    expect(css).not.toContain('tbl-click');
    expect(css).toMatch(/tr\.tbl-row:hover td\{background/);
    expect(css).not.toMatch(/tr\.tbl-row[^{]*\{[^}]*cursor:pointer/);
  });

  it('the admin address carries the /admin basename in front of the record path', () => {
    expect(eduLinkHref(athleteRecordTo('abc'))).toBe('/admin/plugins/edusport-sportivi/abc');
  });
});
