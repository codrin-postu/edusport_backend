import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ANUNT_LIST_COPY } from '../anunturi/portal-history';

const dash = (p: string): string => readFileSync(join(__dirname, '../../admin/dashboard', p), 'utf8');
const src = dash('AnuntEditPage.tsx');

describe('Anunț editor source', () => {
  it('has "Unde apare" with Site and Portal sportiv boxes', () => {
    expect(src).toContain('Unde apare');
    expect(src).toMatch(/label="Site"/);
    expect(src).toMatch(/label="Portal sportiv"/);
  });

  it('shows "Pentru cine" only when the portal is ticked, with the two options', () => {
    expect(src).toMatch(/v\.showOnPortal && \([\s\S]*Pentru cine/);
    expect(src).toContain('Toate grupele');
    expect(src).toContain('Grupe alese');
    expect(src).toContain('GroupTickTree');
  });

  it('keeps Format and the button fields inside a siteFieldsShown condition', () => {
    const at = src.indexOf('siteFieldsShown(v)');
    expect(at).toBeGreaterThan(0);
    for (const label of ['Format', 'Text buton', 'Link buton']) {
      expect(src.indexOf(label, at)).toBeGreaterThan(at);
    }
  });

  it('has no hint lines', () => {
    expect(src).not.toContain('ui-hint');
    expect(src).not.toMatch(/\bhint=/);
  });
});

describe('Anunțuri list source', () => {
  const list = dash('AnunturiPage.tsx');
  it('is one table with no tabs and a FilterPanel "Unde" with Toate, Site and Portal sportiv', () => {
    expect(list).not.toMatch(/\bTabs\b/);
    expect(list).toContain('<DataTable');
    expect(list).toContain('<FilterPanel');
    expect(list).toMatch(/label: copy\.filterWhere/);
    expect(list).toMatch(/allLabel: copy\.filterAll/);
    expect(list).toMatch(/\{ value: 'site', label: copy\.site \}/);
    expect(list).toMatch(/\{ value: 'portal', label: copy\.portal \}/);
    expect([ANUNT_LIST_COPY.filterWhere, ANUNT_LIST_COPY.filterAll, ANUNT_LIST_COPY.site, ANUNT_LIST_COPY.portal]).toEqual(['Unde', 'Toate', 'Site', 'Portal sportiv']);
  });
  it('has no delete in the rows, a grip only for a row that holds a place in the site order, and opens an automatic row read-only', () => {
    expect(list).not.toContain('Șterge');
    expect(list).not.toMatch(/\bdel\b/);
    expect(list).toMatch(/const i = ordered\.indexOf\(r\);\s+if \(i < 0\) return null;/);
    expect(list).toMatch(/r\.source === 'auto' \? setAuto\(r\)/);
  });
  it('labels the icons with place and state and keeps both slots', () => {
    expect(list).toContain('copy.placeLabel(place, state)');
    expect(list).toMatch(/<PlaceIcon place="site"[\s\S]*<PlaceIcon place="portal"/);
  });
  it('has the approved columns', () => {
    for (const h of ["'Anunț'", 'copy.filterWhere', "'Pentru'", "'Perioadă'", "'Stare'", "'Rezultat'"]) expect(list).toContain(`header: ${h}`);
  });
});

describe('Portal blocks source', () => {
  it('AutoNoticeView renders no input and writes nothing', () => {
    const view = dash('anunturi/AutoNoticeView.tsx');
    expect(view).not.toMatch(/<(Input|Textarea|Checkbox|Switch|Select|SegmentedControl|input|textarea)\b/);
    expect(view).not.toMatch(/\b(put|post|del)\(/);
  });
  it('the accounts link shows only for the club area, and the editor offers Oprește with a confirmation', () => {
    const block = dash('anunturi/PortalRecipients.tsx');
    expect(block).toMatch(/canSeeAccounts && \(\s*<Button[\s\S]*?\{copy\.accountsLink\}/);
    expect(block).toMatch(/open && canSeeAccounts \? summary\.noticeId : null/);
    expect(src).toContain("useAreas().has('club')");
    expect(src).toContain('ANUNT_LIST_COPY.stop}');
    expect(src).toContain('ANUNT_LIST_COPY.stopTitle');
    expect(`${ANUNT_LIST_COPY.stopTitle} ${ANUNT_LIST_COPY.stopMessage}`).toBe('Oprești anunțul? Nu mai apare pe portal.');
    expect(src).toMatch(/<PortalRecipients summary=\{portal\}/);
  });
});
