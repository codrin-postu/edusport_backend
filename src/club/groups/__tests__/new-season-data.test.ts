import { describe, expect, it } from 'vitest';
import { NEW_SEASON_COPY, startToast, step1Rows, summaryText } from '../copy';
import { nextSeasonOf, startableLabel } from '../new-season/detect';
import { startData } from '../new-season/start-data';
import { G_SEASONS, event } from './fake-group-store';
import { facts } from './new-season-facts';

describe('which season can be started (10.1, W23)', () => {
  it('is the one labelled a year after the current one', () => {
    expect(startableLabel([{ label: '2026-2027', isCurrent: true }, { label: '2027-2028', isCurrent: false }])).toBe('2027-2028');
    expect(startableLabel([{ label: '2026-2027', isCurrent: true }, { label: '2028-2029', isCurrent: false }])).toBeNull();
    expect(startableLabel([{ label: '2026-2027', isCurrent: false }, { label: '2027-2028', isCurrent: false }])).toBeNull();
    expect(nextSeasonOf(G_SEASONS)?.id).toBe('s27');
  });
});

describe('step 2 data (10.2)', () => {
  it('one table per section, active groups in order, counts, program at the season end, default ticks', () => {
    const data = startData(facts());
    expect(data.target).toEqual({ documentId: 's27', label: '2027-2028', fee: 200 });
    expect([data.seriesFrom, data.seriesTo]).toEqual(['2027-10-01', '2028-05-31']);
    expect(data.sections.map((s) => s.label)).toEqual(['Școala de patinaj', 'Club']);
    const ib = data.sections[0].groups.find((g) => g.groupId === 'g-ib');
    expect(ib).toMatchObject({ members: 2, inactive: 0, program: 'Sâ, Du 11:00', programState: 'ok', defaultMembers: false, defaultProgram: true });
    const pro = data.sections[1].groups.find((g) => g.groupId === 'g-pro');
    expect(pro).toMatchObject({ members: 3, inactive: 1, program: 'Ma, Jo 18:00', defaultMembers: true, defaultProgram: true });
    expect(pro?.athletes.map((a) => [a.name, a.inactive])).toEqual([['Filip Radu', false], ['Ioana Marin', false], ['Tudor Matei', true]]);
  });

  it('disables the program box without a running series or with one already in the new season (W26)', () => {
    const data = startData(facts({ events: [event({ id: 'e1', recurrence: { ...event({ id: 'x' }).recurrence, seasonEnd: '2027-03-31' } }), event({ id: 'e3', groupId: 'g-pro', recurrence: { ...event({ id: 'x' }).recurrence, seasonStart: '2027-10-02', seasonEnd: '2028-05-31' } })] }));
    expect(data.sections[0].groups.find((g) => g.groupId === 'g-ib')).toMatchObject({ programState: 'none', defaultProgram: false });
    expect(data.sections[1].groups.find((g) => g.groupId === 'g-pro')).toMatchObject({ programState: 'exists', defaultProgram: false });
  });
});

describe('copy (10.2, W29, decided 1 and 2)', () => {
  it('step 1 rows, the fee part left out without a fee', () => {
    expect(step1Rows('2026-2027', '2027-2028', 200)[0]).toEqual({ label: 'Înscrieri', value: 'Formularul trece pe 2027-2028, taxa de membru 200 RON. Deschis sau închis din Setări site, ca acum.' });
    expect(step1Rows('2026-2027', '2027-2028', null)[0].value).toBe('Formularul trece pe 2027-2028. Deschis sau închis din Setări site, ca acum.');
  });

  it('summary with its parts and forms', () => {
    expect(summaryText({ athletes: 14, groups: 2, programGroups: 9, unassigned: 73, inactive: 2 }))
      .toBe('Se copiază 14 sportivi în 2 grupe și programul a 9 grupe. 73 de sportivi rămân fără grupă, 2 inactivi nu se copiază.');
    expect(summaryText({ athletes: 0, groups: 0, programGroups: 9, unassigned: 1, inactive: 1 })).toBe('Se copiază programul a 9 grupe. 1 sportiv rămâne fără grupă, 1 inactiv nu se copiază.');
    expect(summaryText({ athletes: 0, groups: 0, programGroups: 0, unassigned: 0, inactive: 0 })).toBe('Nu se copiază nimic.');
  });

  it('toast with its parts', () => {
    expect(startToast('2027-2028', 14, 10)).toBe('2027-2028 este sezonul curent. 14 sportivi și 10 programe copiate.');
    expect(startToast('2027-2028', 0, 10)).toBe('2027-2028 este sezonul curent. 10 programe copiate.');
    expect(startToast('2027-2028', 1, 0)).toBe('2027-2028 este sezonul curent. 1 sportiv copiat.');
    expect(startToast('2027-2028', 0, 0)).toBe('2027-2028 este sezonul curent.');
  });

  it('keeps the window texts of the spec', () => {
    expect(NEW_SEASON_COPY.title('2027-2028')).toBe('Începe sezonul 2027-2028');
    expect(NEW_SEASON_COPY.stepOf(2)).toBe('Pasul 2 din 3');
    expect(NEW_SEASON_COPY.mainRule).toBe('Grupa principală rămâne aceeași dacă se copiază și ea. Altfel devine principală grupa copiată.');
  });
});
