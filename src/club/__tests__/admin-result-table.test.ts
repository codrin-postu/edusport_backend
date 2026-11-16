import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { eduLinkHref } from '../admin-href';
import { athleteRecordTo } from '../sportivi/routes';

describe('Tabele result row opens the athlete record', () => {
  const table = readFileSync('src/admin/dashboard/sportivi/tabele/ResultTable.tsx', 'utf8');

  it('opens the admin address, not the bare router path', () => {
    expect(table).toContain("window.open(eduLinkHref(athleteRecordTo(id)), '_blank', 'noopener')");
  });

  it('the admin address carries the /admin basename in front of the record path', () => {
    expect(eduLinkHref(athleteRecordTo('abc'))).toBe('/admin/plugins/edusport-sportivi/abc');
  });
});
