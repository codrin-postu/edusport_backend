import { describe, expect, it } from 'vitest';
import { breakBody, breakFormError, draftOfBreak } from '../calendar/pauze-view';
import type { StartData } from '../groups/new-season/start-data';
import { headerState, initialTicks, setSection, startBody, toggleChild, toggleGroup } from '../groups/new-season/window-view';

const BREAKS = [{ id: 'b2', label: 'Vacanța de primăvară', startDate: '2027-04-03', endDate: '2027-04-11' }, { id: 'b1', label: 'Vacanța de iarnă', startDate: '2026-12-20', endDate: '2027-01-07' }];

describe('Pauze (7.1)', () => {

  it('the window needs a name and an end not before the start', () => {
    expect(breakFormError({ label: 'X', startDate: '2026-12-20', endDate: '2026-12-19' })).toBe('Data de sfârșit trebuie să fie după data de început.');
    expect(breakFormError({ label: ' ', startDate: '2026-12-20', endDate: '2026-12-21' })).toBe('Completați numele.');
    expect(breakFormError(draftOfBreak(BREAKS[0]))).toBeNull();
    expect(breakBody({ label: ' Iarnă ', startDate: '2026-12-20', endDate: '2026-12-20' })).toEqual({ label: 'Iarnă', startDate: '2026-12-20', endDate: '2026-12-20' });
  });
});

const child = (athleteId: string, inactive = false) => ({ athleteId, name: athleteId, age: 12, inactive, currentMainGroupId: 'g-pro' });
const DATA: StartData = {
  current: { documentId: 's26', label: '2026-2027' }, target: { documentId: 's27', label: '2027-2028', fee: 200 }, seriesFrom: '2027-10-01', seriesTo: '2028-05-31',
  sections: [
    { sectionId: 'afi', label: 'Școala de patinaj', groups: [
      { groupId: 'g-ib', name: 'Intermediari Bronze', members: 2, inactive: 0, program: 'Sâ, Du 11:00', programState: 'ok', defaultMembers: false, defaultProgram: true, athletes: [child('a1'), child('a4')] },
      { groupId: 'g-pp', name: 'Primii Pași', members: 0, inactive: 0, program: '', programState: 'none', defaultMembers: false, defaultProgram: false, athletes: [] },
    ] },
    { sectionId: 'club', label: 'Club', groups: [
      { groupId: 'g-pro', name: 'Profesioniști', members: 3, inactive: 1, program: 'Ma, Jo 18:00', programState: 'exists', defaultMembers: true, defaultProgram: false, athletes: [child('a1'), child('a2'), child('a3', true)] },
    ] },
  ],
};

describe('step 2 ticks (10.2, W26)', () => {
  it('default ticks; header states with mixed and disabled rows', () => {
    const ticks = initialTicks(DATA);
    expect(ticks['g-pro']).toEqual({ members: true, program: false, excluded: [] });
    expect(headerState(DATA.sections[0], ticks, 'program')).toEqual({ checked: true, indeterminate: false, disabled: false });
    expect(headerState(DATA.sections[0], ticks, 'members')).toEqual({ checked: false, indeterminate: false, disabled: false });
    expect(headerState(DATA.sections[1], ticks, 'program')).toEqual({ checked: false, indeterminate: false, disabled: true });
    const mixed = setSection(DATA.sections[0], ticks, 'members', true);
    expect([mixed['g-ib'].members, mixed['g-pp'].members]).toEqual([true, false]);
  });

  it('unticking a child applies to that group only; ticking the group ticks every child again', () => {
    let ticks = toggleChild(initialTicks(DATA), 'g-pro', 'a1');
    expect(ticks['g-pro'].excluded).toEqual(['a1']);
    ticks = toggleGroup(toggleGroup(ticks, DATA.sections[1].groups[0], 'members'), DATA.sections[1].groups[0], 'members');
    expect(ticks['g-pro']).toEqual({ members: true, program: false, excluded: [] });
  });

  it('the request carries every group of every section', () => {
    expect(startBody(DATA, initialTicks(DATA))).toEqual({ groups: [
      { groupId: 'g-ib', copyMembers: false, copyProgram: true, excludeAthleteIds: [] },
      { groupId: 'g-pp', copyMembers: false, copyProgram: false, excludeAthleteIds: [] },
      { groupId: 'g-pro', copyMembers: true, copyProgram: false, excludeAthleteIds: [] },
    ] });
  });
});
