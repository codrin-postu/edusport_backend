import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(join(__dirname, '../../admin/dashboard/bani/styles.ts'), 'utf8');

describe('athlete Prezențe rows', () => {
  it('rows are 40px', () => {
    expect(css).toContain('.bn-hist-row{display:flex;align-items:center;width:100%;height:40px;');
    expect(css).toContain('.bn-hist-exp .ui-row-h{padding:0 6px}');
    expect(css).toContain('.bn-hist-exp .ui-row-toggle{min-height:38px}');
  });

  it('the chevron shows on hover or focus, always on touch and phone', () => {
    expect(css).toContain('.bn-hist-exp .ui-row-chev{opacity:0}');
    expect(css).toContain('.bn-hist-exp .ui-row-toggle:hover .ui-row-chev');
    expect(css).toContain('.bn-hist-exp .ui-row-toggle:focus-visible .ui-row-chev');
    expect(css).toMatch(/@media \(pointer:coarse\),\(hover:none\),\(max-width:640px\)\{[^}]*\.bn-hist-exp \.ui-row-chev\{opacity:1\}/);
  });

  it('the Grup and pay tags are tighter', () => {
    expect(css).toContain('.bn-hist-cells .ui-badge{padding:0 4px;');
  });
});
