import { describe, expect, it } from 'vitest';
import { FEATURES_COPY } from '../copy';
import {
  applyChange,
  installedPortals,
  readFeatures,
  savedFeatures,
  type Features,
} from '../features';

const both = { portalAntrenori: true, portalParinti: true };
const allOn: Features = {
  prezenta: true,
  abonamente: true,
  portalAntrenori: true,
  portalParinti: true,
  parcurs: true,
};

describe('readFeatures', () => {
  it('treats missing or malformed rows as all active', () => {
    expect(readFeatures(null, both)).toEqual(allOn);
    expect(readFeatures({ features: 'x' }, both)).toEqual(allOn);
  });

  it('turns abonamente off when prezenta is off', () => {
    const r = readFeatures({ features: { prezenta: false, abonamente: true } }, both);
    expect(r.prezenta).toBe(false);
    expect(r.abonamente).toBe(false);
  });

  it('ands portals with installed', () => {
    const r = readFeatures({}, { portalAntrenori: false, portalParinti: true });
    expect(r.portalAntrenori).toBe(false);
    expect(r.portalParinti).toBe(true);
  });

  it('savedFeatures ignores installation', () => {
    expect(savedFeatures({ features: { portalParinti: true } }).portalAntrenori).toBe(true);
  });
});

describe('applyChange', () => {
  it('switches abonamente off with prezenta', () => {
    const r = applyChange(allOn, 'prezenta', false, both);
    expect(r).toMatchObject({ ok: true, alsoOff: ['abonamente'] });
    if (r.ok) expect(r.next.abonamente).toBe(false);
  });

  it('refuses abonamente while prezenta is off', () => {
    const saved = { ...allOn, prezenta: false, abonamente: false };
    expect(applyChange(saved, 'abonamente', true, both)).toEqual({
      ok: false,
      code: 'needsPrezenta',
    });
  });

  it('refuses enabling a missing portal but allows switching it off', () => {
    const inst = { portalAntrenori: true, portalParinti: false };
    expect(applyChange(allOn, 'portalParinti', true, inst)).toEqual({
      ok: false,
      code: 'notInstalled',
    });
    expect(applyChange(allOn, 'portalParinti', false, inst).ok).toBe(true);
  });
});

describe('installedPortals', () => {
  it('maps hosts to portals', () => {
    expect(installedPortals(['antrenor'])).toEqual({
      portalAntrenori: true,
      portalParinti: false,
    });
  });
});

describe('warning copy', () => {
  it('articulates only the Prezență title', () => {
    expect(FEATURES_COPY.warningTitle('prezenta')).toBe('Dezactivezi Prezența?');
    expect(FEATURES_COPY.warningTitle('abonamente')).toBe('Dezactivezi Abonamente și plăți?');
    expect(FEATURES_COPY.alsoOffLine).toBe('Odată cu Prezența se dezactivează și:');
  });
});
