import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { breakdownCards, visibleGroups } from '../bani/money-view';
import { NO_GROUP } from '../money/types';
import { downloadGet } from '../../admin/dashboard/inscrieri/downloadPdf';

const src = (p: string) => readFileSync(join(__dirname, '..', '..', p), 'utf8');
const m = (due: number, paid: number) => ({ due, paid, left: due - paid, percent: due === 0 ? null : Math.round((paid / due) * 100) });

describe('final review fixes (11-5)', () => {
  it('F1: the "din N datorat" line sits under De încasat, Încasat keeps only the trend', () => {
    const s = src('admin/dashboard/bani/BaniCards.tsx');
    expect(s).toMatch(/c\.collected, ron\(cards\.collected\), trend\)/);
    expect(s).toMatch(/c\.left, ron\(cards\.left\), BANI_COPY\.dueOf\(ron\(cards\.due\)\)\)/);
  });

  it('F2: the coach CSVs use downloadGet and the pages show the server text', () => {
    const api = src('admin/dashboard/prezenta/api.ts');
    expect(api).not.toMatch(/downloadPdf\(/);
    expect(api.match(/downloadGet\(/g)?.length).toBe(2);
    expect(src('admin/dashboard/prezenta/CoachesList.tsx')).toMatch(/blobErrorText/);
    expect(src('admin/dashboard/prezenta/CoachPage.tsx')).toMatch(/blobErrorText/);
  });

  it('F3: card label and value sit at the top, the caption at the bottom', () => {
    const s = src('admin/dashboard/bani/styles.ts');
    expect(s).toMatch(/\.bn-sq \.ui-stat\{[^}]*justify-content:flex-start/);
    expect(s).not.toMatch(/\.bn-sq \.ui-stat\{[^}]*space-between/);
    expect(s).toMatch(/\.bn-sq \.ui-stat-caption\{margin-top:auto\}/);
  });

  it('F4: on a phone the breakdown is one card per group row under section headers', () => {
    const blocks = [
      { sectionId: 's1', sectionName: 'Club', totals: m(300, 100), groups: [{ groupId: 'a', groupName: 'Avansați', totals: m(100, 100) }, { groupId: 'b', groupName: 'Incepători', totals: m(200, 0) }] },
      { sectionId: NO_GROUP, sectionName: 'Fără grupă', totals: m(50, 0), groups: [{ groupId: NO_GROUP, groupName: 'Fără grupă', totals: m(50, 0) }] },
    ];
    const cards = breakdownCards(blocks);
    expect(cards.map((c) => [c.header, c.rows.map((r) => r.name)])).toEqual([['Club', ['Avansați', 'Incepători']], [null, ['Fără grupă']]]);
    expect(cards[0].rows[1].totals).toEqual(m(200, 0));
    const s = src('admin/dashboard/bani/BaniBreakdown.tsx');
    expect(s).toMatch(/useIsPhone\(\)/);
    expect(s).toMatch(/breakdownCards\(/);
    expect(src('admin/dashboard/bani/styles.ts')).toMatch(/\.bn-sechead\{/);
  });

  it('F5: a month other than the current one shows the abonament cards without a link', () => {
    const s = src('admin/dashboard/bani/BaniCards.tsx');
    expect(s).toMatch(/current: boolean/);
    expect(s).toMatch(/current \? abonamenteStateTo\('active'\) : null/);
    expect(s).toMatch(/current \? abonamenteStateTo\('expira14'\) : null/);
    expect(src('admin/dashboard/BaniPage.tsx')).toMatch(/current=\{query\.month === monthOf\(today\)\}/);
  });

  describe('F6: a failed token refresh ends the session', () => {
    afterEach(() => vi.unstubAllGlobals());
    it('calls onSessionExpired and rethrows', async () => {
      vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 401 })));
      const refresh = vi.fn(async () => { throw new Error('expired'); });
      const onSessionExpired = vi.fn();
      await expect(downloadGet('t', '/x', 'f.csv', { refresh, onSessionExpired })).rejects.toThrow('expired');
      expect(onSessionExpired).toHaveBeenCalledTimes(1);
    });
    it('the three download callers pass the Strapi helpers', () => {
      const o = src('admin/dashboard/inscrieri/strapiDownload.ts');
      expect(o).toMatch(/triggerSessionExpired/);
      expect(o).toMatch(/attemptTokenRefresh/);
      for (const f of ['admin/dashboard/bani/BaniAccounting.tsx', 'admin/dashboard/prezenta/api.ts', 'admin/dashboard/sportivi/tabele/api.ts']) expect(src(f)).toMatch(/strapiDownload/);
    });
  });

  it('F7: the fallback file name is the server one', () => {
    const s = src('admin/dashboard/bani/BaniAccounting.tsx');
    expect(s).toMatch(/`contabil-\$\{month\}\.\$\{format\}`/);
    expect(s).not.toMatch(/contabilitate-\$\{month\}/);
  });

  it('F8: no whitespace-only line in the subscriptions read chain', () => {
    expect(src('club/presence/subscriptions/reads.ts')).not.toMatch(/\}\)\n[ \t]+\n\s*\.filter/);
  });

  it('F9: the group row is hidden by the Fără grupă key, not by a label', () => {
    const g = [{ groupId: 'a', groupName: 'Club', totals: m(0, 0) }];
    expect(visibleGroups({ sectionId: 's1', sectionName: 'Club', groups: g })).toEqual(g);
    expect(visibleGroups({ sectionId: NO_GROUP, sectionName: 'Fără grupă', groups: [{ groupId: NO_GROUP, groupName: 'Fără grupă', totals: m(0, 0) }] })).toEqual([]);
  });
});
