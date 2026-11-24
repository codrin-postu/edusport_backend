import { describe, expect, it } from 'vitest';
import { FEATURES_COPY } from '../copy';
import { ALL_ON, type FeaturesResponse } from '../features';
import { featureRows, lastChangeLine, warningFor } from '../page-view';

const data = (over: Partial<FeaturesResponse> = {}): FeaturesResponse => ({
  saved: ALL_ON,
  features: ALL_ON,
  installed: { portalAntrenori: true, portalParinti: true },
  lastChange: null,
  ...over,
});
const row = (rows: ReturnType<typeof featureRows>, key: string) => rows.find((r) => r.key === key)!;

describe('featureRows', () => {
  it('all on: five enabled rows with their own text', () => {
    const rows = featureRows(data());
    expect(rows).toHaveLength(5);
    expect(rows.every((r) => r.on && !r.disabled && r.reason === null)).toBe(true);
    expect(row(rows, 'prezenta').text).toBe(FEATURES_COPY.items.prezenta.text);
  });

  it('prezenta off: abonamente disabled with the dependent line, coach text shortened', () => {
    const rows = featureRows(data({ saved: { ...ALL_ON, prezenta: false, abonamente: false } }));
    expect(row(rows, 'abonamente')).toMatchObject({ on: false, disabled: true, reason: 'needsPrezenta', text: FEATURES_COPY.needsPrezenta });
    expect(row(rows, 'portalAntrenori').text).toBe(FEATURES_COPY.coachTextWithoutPrezenta);
    expect(row(rows, 'portalAntrenori').disabled).toBe(false);
  });

  it('portal not installed: disabled, off, not-installed line', () => {
    const rows = featureRows(data({ installed: { portalAntrenori: true, portalParinti: false } }));
    expect(row(rows, 'portalParinti')).toMatchObject({ on: false, disabled: true, reason: 'notInstalled', text: FEATURES_COPY.notInstalled });
    expect(row(rows, 'portalAntrenori').disabled).toBe(false);
  });

  it('a switch saved off shows off and stays enabled', () => {
    const rows = featureRows(data({ saved: { ...ALL_ON, parcurs: false } }));
    expect(row(rows, 'parcurs')).toMatchObject({ on: false, disabled: false });
  });
});

describe('warningFor', () => {
  const installed = { portalAntrenori: true, portalParinti: true };
  it('prezenta lists Abonamente și plăți', () => {
    const w = warningFor(ALL_ON, 'prezenta', installed);
    expect(w.alsoOff).toEqual(['Abonamente și plăți']);
    expect(w.title).toBe('Dezactivezi Prezența?');
    expect(w.body).toBe(FEATURES_COPY.warning.prezenta);
  });
  it('parcurs lists nothing; prezenta with abonamente already off lists nothing', () => {
    expect(warningFor(ALL_ON, 'parcurs', installed).alsoOff).toEqual([]);
    expect(warningFor({ ...ALL_ON, abonamente: false }, 'prezenta', installed).alsoOff).toEqual([]);
  });
});

describe('lastChangeLine', () => {
  it('null without a change, a sentence with one', () => {
    expect(lastChangeLine(null)).toBeNull();
    expect(lastChangeLine({ by: 'a@b.ro', at: '2026-11-24T10:00:00.000Z' })).toMatch(/^Ultima modificare: a@b\.ro, .*2026\.$/);
  });
});
