import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(join(__dirname, '../../admin/dashboard/DashboardPage.tsx'), 'utf8');

describe('Acasa cards', () => {
  it('no card text under 11px, sizes come from the caption token', () => {
    expect(src).not.toMatch(/font-size:(9|10)(\.\d+)?px/);
    expect(src).toContain('font-size:var(--ui-fs-caption)');
  });

  it('cards sit one spacing step further apart', () => {
    expect(src).toContain('.dash-grid{display:grid;grid-template-columns:1.5fr 1fr;gap:var(--ui-space-5);');
    expect(src).toContain('.dash-col{display:flex;flex-direction:column;gap:var(--ui-space-5);');
    expect(src).toContain('.dash-kpis{grid-template-columns:repeat(4,minmax(0,1fr));gap:var(--ui-space-5)}');
  });
});
