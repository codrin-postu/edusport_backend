import { describe, expect, it } from 'vitest';
import type { Features } from '../../features/features';
import { CATALOG } from '../catalog';
import type { CatalogAnswer } from '../catalog-api';
import { gateCatalog, gateViews, offFeatureOfBody } from '../features';
import { READY_MADE } from '../ready-made';

const on: Features = { prezenta: true, abonamente: true, portalAntrenori: true, portalParinti: true, parcurs: true };
const catalog = { subjects: CATALOG, readyMade: READY_MADE } as unknown as CatalogAnswer;

describe('table feature gate', () => {
  it('keeps everything while all is on', () => {
    expect(Object.keys(gateCatalog(catalog, on).subjects).sort()).toEqual(Object.keys(CATALOG).sort());
  });
  it('leaves out the subjects of a disabled feature and their ready-made views', () => {
    const off = gateCatalog(catalog, { ...on, prezenta: false, abonamente: false });
    expect(Object.keys(off.subjects)).toEqual(['sportivi']);
    expect(off.readyMade.every((v) => v.subject === 'sportivi')).toBe(true);
  });
  it('leaves out saved views of a disabled subject', () => {
    const rows = READY_MADE.filter((v) => v.subject === 'prezenta' || v.subject === 'sportivi');
    expect(gateViews(rows, { ...on, prezenta: false }).every((v) => v.subject === 'sportivi')).toBe(true);
  });
  it('names the feature that refuses a body', () => {
    expect(offFeatureOfBody({ definition: { subject: 'plati' } }, { ...on, abonamente: false })).toBe('abonamente');
    expect(offFeatureOfBody({ definition: { subject: 'plati' } }, on)).toBeNull();
    expect(offFeatureOfBody({ definition: { subject: 'sportivi' } }, { ...on, prezenta: false })).toBeNull();
    expect(offFeatureOfBody(null, on)).toBeNull();
  });
});
