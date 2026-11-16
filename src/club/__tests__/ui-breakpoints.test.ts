import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BP, phoneQuery, tabletQuery } from '../ui-breakpoints';
import { RAIL_OVERLAY_MAX } from '../tables/shell-state';

const admin = (rel: string) => readFileSync(join(__dirname, '../../admin', rel), 'utf8');
const styles = admin('ui/styles.ts');

describe('one breakpoint set', () => {
  it('has a phone and a tablet width and queries built from them', () => {
    expect(BP).toEqual({ phone: 640, tablet: 1024 });
    expect(phoneQuery).toBe('(max-width:640px)');
    expect(tabletQuery).toBe('(max-width:1024px)');
  });

  it('ui styles hold no other width query', () => {
    expect(styles).not.toMatch(/max-width:\s*(720|900|1040)px\)/);
    expect(styles).not.toMatch(/@media \(max-width/);
  });

  it('.ui-two stacks only at the phone width, a rail is a fixed column on tablet', () => {
    expect(styles).toMatch(/\$\{PHONE_MQ\}\{\$\{R\} \.ui-two\{grid-template-columns:1fr\}/);
    expect(styles).not.toMatch(/\$\{TABLET_MQ\}\{\$\{R\} \.ui-two\{grid-template-columns:1fr/);
    expect(styles).toMatch(/\$\{TABLET_MQ\}\{\$\{R\} \.ui-two\{grid-template-columns:var\(--ui-rail-w-tablet,240px\) minmax\(0,1fr\)\}/);
  });

  it('the inbox and the split panes collapse at the tablet width', () => {
    expect(styles).toMatch(/\$\{TABLET_MQ\}\{\$\{R\} \.ui-inbox\{grid-template-columns:1fr\}/);
    expect(admin('dashboard/SubmissionTable.tsx')).toMatch(/@media \$\{tabletQuery\}\{\.ui-root \.sbt-split\{/);
    expect(admin('dashboard/inscrieri/styles.ts')).toContain('BP.tablet + 1');
  });

  it('the Tabele rail is a slide-over up to the tablet width', () => {
    expect(RAIL_OVERLAY_MAX).toBe(BP.tablet);
    expect(admin('dashboard/sportivi/tabele/styles.ts')).toContain('@media ${tabletQuery}{');
  });
});
