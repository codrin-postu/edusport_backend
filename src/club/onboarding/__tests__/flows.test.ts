import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { AdminArea } from '../../admin-area';
import { FLOWS, INTRO_STEPS, flowsFor } from '../flows';

const ALL_ON = () => true;
const areas = (...a: AdminArea[]) => (x: AdminArea) => a.includes(x);
const ids = (has: (a: AdminArea) => boolean, on = ALL_ON) => flowsFor(has, on).map((f) => f.id);
const built = FLOWS.filter((f) => f.steps !== null);
const allSteps = [...built.flatMap((f) => f.steps ?? []), ...INTRO_STEPS];

describe('flowsFor', () => {
  it('gives a club admin the built flows only', () => {
    const got = ids(areas('any', 'club', 'website', 'money'));
    expect(got).toEqual(['inscriere', 'sportiv', 'grupa', 'prezenta', 'anunt']);
    expect(got).not.toContain('pagina');
  });
  it('gives an editor the announcement flow only', () => {
    expect(ids(areas('any', 'website'))).toEqual(['anunt']);
  });
  it('drops prezenta when its switch is off', () => {
    expect(ids(areas('any', 'club', 'website'), (k) => k !== 'prezenta')).toEqual(['inscriere', 'sportiv', 'grupa', 'anunt']);
  });
  it('gives Super Admin the club set', () => {
    expect(ids(() => true)).toEqual(['inscriere', 'sportiv', 'grupa', 'prezenta', 'anunt']);
  });
});

describe('catalogue', () => {
  it('keeps titles and texts within the copy limits', () => {
    for (const s of allSteps) {
      expect(s.title.length).toBeLessThanOrEqual(60);
      expect((s.text ?? '').length).toBeLessThanOrEqual(130);
    }
  });
  it('has a title and an anchor on every step', () => {
    for (const s of allSteps) {
      expect(s.title).toBeTruthy();
      expect(s.anchor).toBeTruthy();
    }
  });
  it('ends every built flow with exactly one final step', () => {
    for (const f of built) {
      const steps = f.steps ?? [];
      expect(steps.filter((s) => s.final)).toHaveLength(1);
      expect(steps[steps.length - 1].final).toBe(true);
    }
  });
  it('uses no forbidden characters or words in the copy files', () => {
    for (const file of ['copy.ts', 'flows.ts']) {
      const src = readFileSync(join(__dirname, '..', file), 'utf8');
      expect(src).not.toMatch(/Strapi|[–—·‘’“”]/);
    }
  });
});
