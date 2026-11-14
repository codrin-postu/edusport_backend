import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(join(__dirname, '../../admin/dashboard/AnuntEditPage.tsx'), 'utf8');

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
