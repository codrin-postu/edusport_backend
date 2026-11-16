import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { scaleVars, tokensCss } from '../../admin/ui/tokens';
import { SELECT_EMPTY_LABEL } from '../ui-select';

const read = (rel: string) => readFileSync(join(__dirname, '../../admin', rel), 'utf8');
const styles = read('ui/styles.ts');
const LOCAL = ['dashboard/sportivi/styles.ts', 'dashboard/SubmissionTable.tsx', 'dashboard/sportivi/tabele/styles.ts', 'dashboard/prezenta/styles.ts', 'dashboard/inscrieri/styles.ts', 'dashboard/grupe/styles.ts'];
const FIRST_LAST = /\.ui-win > \.ui-table-wrap \.ui-table th:first-child[^\n]*\{padding-left:var\(--ui-inset\)\}/;

const RULES = [
  '.ui-ph',
  '.ui-body',
  '.ui-rail',
  '.ui-ecard-f',
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
    expect(styles).toContain(':not(.ui-body):not(.ui-ecard-b) .ui-table-wrap');
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

const CTL = '${H}';

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : [p];
  });
}

describe('one card, one rhythm', () => {
  it('fields are 12 apart in a card, blocks 16 apart in a body', () => {
    expect(ruleBody('.ui-body')).toContain('gap:var(--ui-space-4)');
    expect(ruleBody('.ui-ecard-b')).toContain('gap:var(--ui-space-3)');
    expect(read('dashboard/SubmissionTable.tsx')).toMatch(/\.sbt-fld\{margin-bottom:var\(--ui-space-3\)\}/);
    expect(read('pages/securitate/layout.tsx')).toContain("gap: 'var(--ui-space-3)'");
  });

  it('Section is gone: no ui-sec classes anywhere in the admin', () => {
    expect(existsSync(join(__dirname, '../../admin/ui/Section.tsx'))).toBe(false);
    const hits = files(join(__dirname, '../../admin')).filter((f) => /\.tsx?$/.test(f) && /ui-sec-|\.ui-sec\b/.test(readFileSync(f, 'utf8')));
    expect(hits).toEqual([]);
  });

  it('EditorCard has the plain variant and a footer', () => {
    const card = read('ui/EditorCard.tsx');
    expect(card).toContain("variant?: 'plain'");
    expect(card).toContain('ui-ecard-f');
    expect(styles).toContain('.ui-ecard--plain');
  });
});

describe('one control height', () => {
  it('has the two tokens, and the helper resolves them', () => {
    expect(styles).toContain("const H = 'var(--ui-ctl, var(--ui-control-h))';");
    expect(scaleVars()['--ui-control-h']).toBeDefined();
    expect(scaleVars()['--ui-control-h-sm']).toBeDefined();
  });

  it.each(['.ui-btn', '.ui-input', '.ui-pg', '.ui-iconbtn', '.ui-add', '.ui-tab', '.ui-seg'])('%s takes its height from the control token', (sel) => {
    const line = styles.split('\n').find((l) => l.startsWith('${R} ' + sel + '{') || l.startsWith('.ui-root' + sel + '{'));
    const m = line ? [line, line] : null;
    expect(m, sel).not.toBeNull();
    expect(m![1]).toContain(CTL);
  });

  it('controls in table cells take the small token', () => {
    expect(styles).toMatch(/td,\$\{R\} th\{--ui-ctl:var\(--ui-control-h-sm\)\}|td,\.ui-root th\{--ui-ctl:var\(--ui-control-h-sm\)\}/);
  });

  it('page-local controls use the token, not their own height', () => {
    expect(read('dashboard/prezenta/styles.ts')).toContain('var(--ui-control-h)');
    expect(read('dashboard/inscrieri/styles.ts')).toContain('height:var(--ui-control-h)');
    expect(read('dashboard/sportivi/styles.ts')).not.toMatch(/min-height:40px/);
  });

  it('the group roster table starts at the title edge, not 14px in', () => {
    expect(read('dashboard/grupe/styles.ts')).toMatch(/\.grp-roster td:first-child\{padding-left:0\}/);
    expect(read('dashboard/grupe/RosterTab.tsx')).toContain('ui-table grp-roster');
  });

  it('the time icon sits on the right, like the date picker', () => {
    const btn = styles.match(/\.ui-time-btn\{([^}]*)\}/)![1];
    expect(btn).toContain('right:');
    expect(btn).not.toContain('left:');
    expect(ruleBody('.ui-time .ui-input')).toContain('padding-right');
  });

  it('a select with nothing chosen shows Selectează', () => {
    expect(SELECT_EMPTY_LABEL).toBe('Selectează');
    expect(read('ui/Select.tsx')).toContain('SELECT_EMPTY_LABEL');
    expect(read('ui/SearchableSelect.tsx')).toContain('SELECT_EMPTY_LABEL');
  });
});
