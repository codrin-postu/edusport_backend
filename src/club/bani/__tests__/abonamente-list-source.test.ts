import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const file = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8');
const list = file('../../../admin/dashboard/bani/AbonamenteList.tsx');
const bar = file('../../../admin/dashboard/bani/AbonamentBar.tsx');
const css = file('../../../admin/dashboard/bani/styles.ts');

describe('Abonamente list rows (approved p5-2 mockup)', () => {
  it('desktop used column and phone cards both show the segment bar, not the plain 2/8 text alone', () => {
    expect(list.match(/<AbonamentBar bar=\{segBar\(r\)\} compact \/>/g)).toHaveLength(2);
    expect(list).toContain("import { AbonamentBar } from './AbonamentBar';");
  });

  it('state renders as a StatusBadge with the tones of the mockup (activ ok, epuizat neutral, anulat danger)', () => {
    expect(list).toContain("import { AdminPage, Button, DataTable, FilterPanel, Loading, Notice, PageHeader, StatusBadge,");
    expect(list).toContain("{ activ: 'success', epuizat: 'neutral', expirat: 'warning', anulat: 'danger' }");
    expect(list.match(/<StatusBadge tone=\{STATE_TONE\[r\.state\]\}>/g)).toHaveLength(2);
    expect(list).not.toMatch(/key: 'state'[^\n]*cell\(/);
  });

  it('compact bar renders segments only, the full bar keeps its title and foot', () => {
    expect(bar).toContain('compact?: boolean');
    expect(bar).toContain("compact ? 'bn-bar-segs bn-bar-segs--compact' : 'bn-bar-segs'");
    expect(bar).toContain('if (compact) return segs;');
  });

  it('compact segments are fixed square 10px boxes, tokens only', () => {
    expect(css).toContain('.ui-root .bn-bar-segs--compact .bn-seg{flex:none;width:10px;height:10px}');
    expect(css).not.toMatch(/bn-(seg|bar|used|card-meta)[^}]*border-radius/);
  });
});
