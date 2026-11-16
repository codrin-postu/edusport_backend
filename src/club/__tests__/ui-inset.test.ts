import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { scaleVars, tokensCss } from '../../admin/ui/tokens';

const read = (rel: string) => readFileSync(join(__dirname, '../../admin', rel), 'utf8');
const styles = read('ui/styles.ts');
const LOCAL = ['dashboard/sportivi/styles.ts', 'dashboard/SubmissionTable.tsx', 'dashboard/sportivi/tabele/styles.ts', 'dashboard/prezenta/styles.ts', 'dashboard/inscrieri/styles.ts', 'dashboard/grupe/styles.ts'];
const FIRST_LAST = /\.ui-win > \.ui-table-wrap \.ui-table th:first-child[^\n]*\{padding-left:var\(--ui-inset\)\}/;

const RULES = [
  '.ui-ph',
  '.ui-body',
  '.ui-rail',
  '.ui-sec-h',
  '.ui-sec-b',
  '.ui-sec-f',
  '.ui-ecard-h',
  '.ui-ecard-b',
  '.ui-row-b',
  '.ui-modal-h',
  '.ui-modal-b',
  '.ui-modal-f',
  '.ui-drawer-h',
  '.ui-sheet-h',
];

function ruleBody(sel: string): string {
  const esc = sel.replace(/[.\-]/g, '\\$&');
  const m = styles.match(new RegExp('\\} ' + esc + '\\{([^}]*)\\}'));
  if (!m) throw new Error('rule not found: ' + sel);
  return m[1];
}

describe('--ui-inset', () => {
  it('is 16px, 12px on phones', () => {
    expect(scaleVars()['--ui-inset']).toBe('16px');
    expect(tokensCss()).toMatch(/@media \(max-width:640px\)\{[^{]*\{--ui-inset:12px;\}\}/);
  });

  it.each(RULES)('%s takes its horizontal padding from the token', (sel) => {
    const body = ruleBody(sel);
    expect(body).toContain('var(--ui-inset)');
    const pad = body.match(/(?:^|;)padding:([^;]*)/)?.[1] ?? '';
    for (const n of ['13px', '14px', '15px', '18px']) {
      const parts = pad.split(/\s+/);
      const horizontal = parts.length === 1 ? [parts[0]] : [parts[1], parts[3] ?? parts[1]];
      expect(horizontal).not.toContain(n);
    }
  });
});

describe('tables, tabs and toolbars on the token', () => {
  it('.ui-tabs takes its inline padding from the token', () => {
    expect(styles).toMatch(/\.ui-tabs\{[^}]*padding-inline:var\(--ui-inset\)/);
  });

  it('flush window tables align first and last cells to the token, not body or section tables', () => {
    expect(styles).toMatch(FIRST_LAST);
    expect(styles).toMatch(/\.ui-win > \.ui-table-wrap \.ui-table td:last-child[^\n]*\{padding-right:var\(--ui-inset\)\}/);
    expect(styles).toContain(':not(.ui-body):not(.ui-sec-b) .ui-table-wrap');
  });

  it('bars and pager use the token with 12px vertical padding', () => {
    for (const sel of ['.ui-table-bar', '.ui-table-pager']) {
      expect(ruleBody(sel)).toMatch(/padding:12px var\(--ui-inset\)/);
    }
  });

  it('the Sportivi tab rule is gone', () => {
    expect(read('dashboard/sportivi/styles.ts')).not.toContain('spv-tabs');
  });

  it.each(LOCAL)('%s: horizontal padding of the bars comes from the token', (file) => {
    const src = read(file);
    const re = /\.(spv|sbt|tbl|pz)-(toolbar|chips|banner|foot|bulk|dups|tbB|controls|bar|legend|label|notices|ph|pb|pa|schools|tabs|count|pager|loading|empty|select-all|more)\{[^}]*\}/g;
    for (const rule of src.match(re) ?? []) {
      const pad = rule.match(/(?:^|[;{])padding:([^;}]*)/)?.[1];
      if (pad) expect(rule, rule).toContain('var(--ui-inset)');
    }
  });
});
