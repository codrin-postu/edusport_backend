import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const dir = join(__dirname, '../../admin/dashboard/sportivi');
const table = readFileSync(join(dir, 'AthleteTable.tsx'), 'utf8');
const css = readFileSync(join(dir, 'styles.ts'), 'utf8');

describe('Sportivi table rows', () => {
  it('the Contact cell is the parent name on one line, without the phone', () => {
    expect(table).toContain('<td className="spv-contact">{row.contactName}</td>');
    expect(table).not.toContain('row.phone');
    expect(css).toContain('.spv-contact{white-space:nowrap}');
  });

  it('rows are 44px', () => {
    expect(table).toContain('className="ui-table-click spv-trow"');
    expect(css).toContain('.spv-trow td{height:44px;');
  });
});
