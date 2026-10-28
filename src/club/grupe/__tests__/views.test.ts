import { describe, expect, it } from 'vitest';
import type { GroupListPage, GroupPage, MemberRow } from '../../groups/api-types';
import { addCandidates, groupTabs, mainText, memberMenuItems, othersText, phoneMemberLine, subtitle } from '../group-view';
import { allocateItems, coachesText, countLine, groupOptions, initialPicks, joinableGroups, phoneSummary, seasonOptions, tabItems, wroteNothing, writable } from '../list-view';
import { groupIdFromSplat, groupPageTo, grupeListTo, readGrupeQuery } from '../routes';

const LIST: GroupListPage = {
  season: { documentId: 's26', label: '2026-2027', past: false },
  seasons: [{ documentId: 's27', label: '2027-2028', isCurrent: false }, { documentId: 's26', label: '2026-2027', isCurrent: true }],
  tabs: [{ documentId: 'afi', slug: 'scoala-afi', label: 'Școala de patinaj', count: 7 }, { documentId: 'club', slug: 'club', label: 'Club', count: 2 }], section: 'scoala-afi',
  athletes: 77, groups: 7, unassigned: 3,
  rows: [{ documentId: 'g1', name: 'Avansați', program: ['Lu, Mi 17:00', 'Sâ 09:00'], coaches: ['Andreea Pascu'], members: 10 }, { documentId: 'g2', name: 'Nou', program: [], coaches: [], members: 1 }],
};
const member = (over: Partial<MemberRow>): MemberRow => ({ membershipId: 'm', athleteId: 'a', name: 'Ana', age: 12, isMain: true, others: [], ...over });
const PAGE: GroupPage = {
  documentId: 'g-ib', name: 'Intermediari Bronze', section: { documentId: 'afi', name: 'Școala de patinaj', kind: 'school' }, priceList: { documentId: 'pl', name: 'Standard' },
  coaches: [{ documentId: 't', name: 'Virgil Pascu' }], programPublic: true, season: { documentId: 's26', label: '2026-2027', past: false },
  members: Array.from({ length: 11 }, (_, i) => member({ membershipId: `m${i}`, athleteId: `a${i}` })), historyCount: 5, deletable: false,
};

describe('routes (5.1, decided 1)', () => {
  it('keeps the season and the tab in the address', () => {
    expect(grupeListTo('2026-2027', 'club')).toBe('/plugins/edusport-grupe?season=2026-2027&section=club');
    expect(grupeListTo(null, null)).toBe('/plugins/edusport-grupe');
    expect(groupPageTo('g 1', '2026-2027', 'program')).toBe('/plugins/edusport-grupe/g%201?season=2026-2027&tab=program');
    expect(groupIdFromSplat('g-ib/x')).toBe('g-ib');
    expect(readGrupeQuery('?season=2027-2028&tab=program')).toEqual({ season: '2027-2028', section: null, tab: 'program' });
  });
});

describe('Grupe list (5.2)', () => {
  it('writes the count line, program lines, coaches and phone cards', () => {
    expect(countLine(LIST)).toBe('77 de sportivi în 7 grupe');
    expect(coachesText(LIST.rows[0])).toBe('Andreea Pascu');
    expect(coachesText(LIST.rows[1])).toBeNull();
    expect(phoneSummary(LIST.rows[0])).toBe('Lu, Mi 17:00, Sâ 09:00, 10 sportivi');
    expect(phoneSummary(LIST.rows[1])).toBe('Fără program, 1 sportiv');
  });

  it('tabs with counts, the season choices, and writes only on a season that is not past (W5)', () => {
    expect(tabItems(LIST)).toEqual([{ id: 'scoala-afi', label: 'Școala de patinaj', count: 7 }, { id: 'club', label: 'Club', count: 2 }]);
    expect(seasonOptions(LIST)).toEqual([{ value: '2027-2028', label: 'Sezon 2027-2028' }, { value: '2026-2027', label: 'Sezon 2026-2027' }]);
    expect(writable(LIST)).toBe(true);
    expect(writable({ ...LIST, season: { documentId: 's25', label: '2025-2026', past: true } })).toBe(false);
  });

  it('"Fără grupă": options with the section as hint, proposals preselected, rows without a group not sent (W6)', () => {
    const groups = [{ documentId: 'g1', name: 'Primii Pași', sectionName: 'Școala de patinaj' }, { documentId: 'g2', name: 'Avansați', sectionName: 'Club' }];
    expect(groupOptions(groups, 'g1')).toEqual([{ value: 'g2', label: 'Avansați', hint: 'Club' }]);
    const rows = [{ athleteId: 'a1', name: 'A', source: '', proposedGroupId: 'g1' }, { athleteId: 'a2', name: 'B', source: '', proposedGroupId: null }];
    const picks = initialPicks(rows);
    expect(allocateItems(rows, picks)).toEqual([{ athleteId: 'a1', groupId: 'g1' }]);
  });
});

describe('group page (6.1, 6.2)', () => {
  it('subtitle: section, coaches, price list, count; "Fără antrenor" and no list part when missing', () => {
    expect(subtitle(PAGE)).toBe('Școala de patinaj, Virgil Pascu, lista Standard, 11 sportivi');
    expect(subtitle({ ...PAGE, coaches: [], priceList: null })).toBe('Școala de patinaj, Fără antrenor, 11 sportivi');
  });

  it('tabs Sportivi (count), Program, Prezență, Istoric (count)', () => {
    expect(groupTabs(PAGE)).toEqual([{ id: 'sportivi', label: 'Sportivi', count: 11 }, { id: 'program', label: 'Program' }, { id: 'prezenta', label: 'Prezență' }, { id: 'istoric', label: 'Istoric', count: 5 }]);
  });

  it('roster cells and the phone line', () => {
    const daria = member({ isMain: false, age: 11, others: [{ name: 'Avansați', isMain: true }] });
    expect([mainText(daria), othersText(daria)]).toEqual(['Nu', 'Avansați (principală)']);
    expect(othersText(member({}))).toBeNull();
    expect(phoneMemberLine(daria)).toBe('11 ani, și în Avansați');
    expect(phoneMemberLine(member({ age: 13, others: [{ name: 'Profesioniști', isMain: false }] }))).toBe('13 ani, principală, și în Profesioniști');
    expect(phoneMemberLine(member({ age: null }))).toBe('principală');
  });

  it('row menu and add candidates', () => {
    expect(memberMenuItems().map((i) => [i.key, i.label, i.danger])).toEqual([['move', 'Mută', false], ['addAlso', 'Adaugă și în grupă', false], ['remove', 'Scoate din grupă', true]]);
    expect(addCandidates([{ athleteId: 'a0', name: 'X' }, { athleteId: 'zz', name: 'Y' }], PAGE.members).map((r) => r.athleteId)).toEqual(['zz']);
  });
});

describe('join rules (final review)', () => {
  const groups = [{ documentId: 'g1', name: 'Mici', sectionName: 'Club' }, { documentId: 'g2', name: 'Avansați', sectionName: 'Club' }, { documentId: 'g3', name: 'Seniori', sectionName: 'Club' }];
  it('the "În" list leaves out this group and the groups the athlete is in', () => {
    expect(joinableGroups(groups, 'g1', [{ name: 'Avansați' }]).map((g) => g.documentId)).toEqual(['g3']);
  });
  it('a join that added nobody wrote nothing', () => {
    expect(wroteNothing({ added: 0 })).toBe(true);
    expect(wroteNothing({ added: 1 })).toBe(false);
  });
});
