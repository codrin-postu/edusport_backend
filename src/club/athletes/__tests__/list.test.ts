import { describe, expect, it } from 'vitest';
import { athleteListPage, readListQuery } from '../list';
import { athleteRow, fakeClubStore, registrationRow } from './fake-store';

const TODAY = { year: 2026, month: 10, day: 26 };
const full = { contactName: 'Ana', phone: '07', email: 'e', dataIncomplete: false };
const fake = () => fakeClubStore({
  athletes: [
    athleteRow({ id: 'a1', name: 'Maria Pop', birthDate: '2016-03-14', profileId: 'sp1', ...full }),
    athleteRow({ id: 'a2', name: 'Andrei Ionescu', birthDate: '2012-01-01', contactName: 'Ion', phone: '07' }),
    athleteRow({ id: 'a3', name: 'Ion Ilie', status: 'inactiv' }),
    athleteRow({ id: 'a4', name: 'Bianca Radu' }),
  ],
  memberships: [
    { id: 'm1', athleteId: 'a1', groupId: 'g-pp', seasonId: 's26', isMain: true, from: null },
    { id: 'm2', athleteId: 'a2', groupId: 'g-pro', seasonId: 's26', isMain: true, from: null },
  ],
  acs: [{ id: 'c1', athleteId: 'a1', seasonId: 's26', state: 'in_asteptare' }, { id: 'c2', athleteId: 'a2', seasonId: 's26', state: 'da' }],
  registrations: [registrationRow({ id: 'r4', athleteId: 'a4', parentName: 'Dana Radu', number: '2026-0099' })],
  profiles: [{ id: 'sp1', name: 'Maria Pop', slug: 'maria-pop', previousSlugs: [], showPublicPage: true, published: true }],
  duplicates: [
    { id: 'd1', firstId: 'a4', secondId: 'a1', dismissed: false },
    { id: 'd2', firstId: 'a2', secondId: 'a3', dismissed: true },
  ],
});
const ids = async (query: Record<string, unknown>) => (await athleteListPage(fake().store, readListQuery(query), TODAY)).data.map((r) => r.documentId);

describe('Sportivi list (spec 5)', () => {
  it('hides inactive athletes unless asked; Nume A-Z by default; counts and banner', async () => {
    const page = await athleteListPage(fake().store, readListQuery({}), TODAY);
    expect(page.data.map((r) => r.documentId)).toEqual(['a2', 'a4', 'a1']);
    expect([page.unfiltered, page.incomplete, page.pagination.total, page.season?.label]).toEqual([3, 2, 3, '2026-2027']);
    expect(await ids({ status: 'inactiv' })).toEqual(['a3']);
  });

  it('a row: age, group of the season, contact, A.C.S., profile, missing fields', async () => {
    const page = await athleteListPage(fake().store, readListQuery({}), TODAY);
    expect(page.data.find((r) => r.documentId === 'a1')).toEqual({
      documentId: 'a1', name: 'Maria Pop', age: 10, birthDate: '14.03.2016', status: 'activ', dataIncomplete: false, missing: [],
      mainGroup: { documentId: 'g-pp', name: 'Primii Pași' }, contactName: 'Ana', phone: '07', acs: 'in_asteptare', publicProfile: 'public', possibleDuplicate: true,
    });
    expect(page.data.find((r) => r.documentId === 'a4')).toMatchObject({ age: null, mainGroup: null, acs: 'nu', publicProfile: 'ascuns', missing: ['data nașterii', 'persoana de contact', 'telefon', 'e-mail'] });
  });

  it('a deploy-marked record stays "Date incomplete" with no field missing: row, count and Date filter (task 27 F2)', async () => {
    const store = fakeClubStore({ athletes: [athleteRow({ id: 'a1', name: 'Luca Stoica', birthDate: '2015-01-01', ...full, dataIncomplete: true })] }).store;
    const page = await athleteListPage(store, readListQuery({}), TODAY);
    expect([page.data[0].dataIncomplete, page.data[0].missing, page.incomplete]).toEqual([true, [], 1]);
    expect((await athleteListPage(store, readListQuery({ data: 'incomplete' }), TODAY)).data.map((r) => r.documentId)).toEqual(['a1']);
    expect((await athleteListPage(store, readListQuery({ data: 'complete' }), TODAY)).data).toEqual([]);
  });

  it('Secțiune: groups of the season, else registrations of the season, else "Fără secțiune" (gaps #35)', async () => {
    expect(await ids({ section: 'afi' })).toEqual(['a4', 'a1']);
    expect(await ids({ section: 'club' })).toEqual(['a2']);
    expect(await ids({ section: 'none', status: 'inactiv' })).toEqual(['a3']);
  });

  it('Grupa, Fără grupă, Membru A.C.S., Profil public, Date, Posibile dubluri', async () => {
    expect(await ids({ group: 'g-pro' })).toEqual(['a2']);
    expect(await ids({ noGroup: 'true' })).toEqual(['a4']);
    expect(await ids({ group: 'g-pro', noGroup: 'true' })).toEqual(['a2', 'a4']);
    expect(await ids({ acs: 'nu' })).toEqual(['a4']);
    expect(await ids({ profile: 'public' })).toEqual(['a1']);
    expect(await ids({ data: 'incomplete' })).toEqual(['a2', 'a4']);
    expect(await ids({ duplicates: 'true' })).toEqual(['a4', 'a1']);
  });

  it('a dismissed duplicate pair does not flag or count as a possible duplicate (Task 11)', async () => {
    const page = await athleteListPage(fake().store, readListQuery({}), TODAY);
    expect(page.data.find((r) => r.documentId === 'a2')?.possibleDuplicate).toBe(false);
    expect(await ids({ duplicates: 'true' })).not.toContain('a2');
  });

  it('searches name, parent and registration number', async () => {
    expect(await ids({ q: 'maria' })).toEqual(['a1']);
    expect(await ids({ q: 'dana radu' })).toEqual(['a4']);
    expect(await ids({ q: '2026-0099' })).toEqual(['a4']);
  });

  it('sorts by age and by group', async () => {
    expect(await ids({ sort: 'age' })).toEqual(['a1', 'a2', 'a4']);
    expect(await ids({ sort: 'group' })).toEqual(['a1', 'a2', 'a4']);
    expect(await ids({ sort: 'name', dir: 'desc' })).toEqual(['a1', 'a4', 'a2']);
  });

  it('descending age/group only flips the primary key: undated/no-group rows stay last, name tie-break stays A-Z (Task 15 pattern)', async () => {
    expect(await ids({ sort: 'age', dir: 'desc' })).toEqual(['a2', 'a1', 'a4']);
    expect(await ids({ sort: 'group', dir: 'desc' })).toEqual(['a2', 'a1', 'a4']);
  });

  it('ties on age or group break by name A-Z in both directions', async () => {
    const tie = fakeClubStore({
      athletes: [
        athleteRow({ id: 't1', name: 'Zoe Ion', birthDate: '2015-01-01' }),
        athleteRow({ id: 't2', name: 'Ana Pop', birthDate: '2015-06-01' }),
      ],
      memberships: [
        { id: 'm1', athleteId: 't1', groupId: 'g-pp', seasonId: 's26', isMain: true, from: null },
        { id: 'm2', athleteId: 't2', groupId: 'g-pp', seasonId: 's26', isMain: true, from: null },
      ],
    });
    const tieIds = async (q: Record<string, unknown>) => (await athleteListPage(tie.store, readListQuery(q), TODAY)).data.map((r) => r.documentId);
    expect(await tieIds({ sort: 'age' })).toEqual(['t2', 't1']);
    expect(await tieIds({ sort: 'age', dir: 'desc' })).toEqual(['t2', 't1']);
    expect(await tieIds({ sort: 'group' })).toEqual(['t2', 't1']);
    expect(await tieIds({ sort: 'group', dir: 'desc' })).toEqual(['t2', 't1']);
  });

  it('the season selector only changes the group and A.C.S. columns (3b s5)', async () => {
    const page = await athleteListPage(fake().store, readListQuery({ season: 's25' }), TODAY);
    expect(page.data.map((r) => [r.documentId, r.mainGroup, r.acs])).toEqual([['a2', null, 'nu'], ['a4', null, 'nu'], ['a1', null, 'nu']]);
  });

  it('pages 50 (desktop) or 30 (phone), and offers the filter options', async () => {
    const page = await athleteListPage(fake().store, readListQuery({ page: '2', pageSize: '30' }), TODAY);
    expect([page.data, page.pagination]).toEqual([[], { page: 2, pageSize: 30, total: 3, pageCount: 1 }]);
    expect(page.options.sections.map((s) => s.label)).toEqual(['Școala de Patinaj - AFI Cotroceni', 'Club', 'Fără secțiune']);
    expect(page.options.groups.map((g) => [g.label, g.sectionName])).toEqual([
      ['Primii Pași', 'Școala de Patinaj - AFI Cotroceni'], ['Intermediari Bronze', 'Școala de Patinaj - AFI Cotroceni'], ['Profesioniști', 'Club'],
    ]);
  });
});

describe('readListQuery', () => {
  it('drops unknown values', () => {
    expect(readListQuery({ status: 'activ,x', acs: 'da,maybe', profile: 'public,y', data: 'z', sort: 'x', page: '-2', pageSize: '100' })).toMatchObject({
      status: ['activ'], acs: ['da'], profile: ['public'], data: [], sort: 'name', dir: 'asc', page: 1, pageSize: 50,
    });
  });

  it('pageSize accepts 50 or a multiple of 30 up to 1200 (phone reload of pages 1..P); anything else falls back to 50', () => {
    const sizes = [30, 90, 300, 330, 1200, 1230, 45, 0, 20];
    expect(sizes.map((pageSize) => readListQuery({ pageSize: String(pageSize) }).pageSize)).toEqual([30, 90, 300, 330, 1200, 50, 50, 50, 50]);
  });
});
