import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { scaleVars, tokensCss } from '../../admin/ui/tokens';

const styles = readFileSync(join(__dirname, '../../admin/ui/styles.ts'), 'utf8');

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
