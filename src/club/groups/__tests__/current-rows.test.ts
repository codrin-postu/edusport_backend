import { describe, expect, it } from 'vitest';
import { cardMaker } from '../../athletes/cards';
import { athleteListPage, readListQuery } from '../../athletes/list';
import { readAthleteRecord } from '../../athletes/record';
import { athleteRow, fakeClubStore } from '../../athletes/__tests__/fake-store';

const TODAY = { year: 2026, month: 11, day: 20 };
const seed = () => fakeClubStore({
  athletes: [athleteRow({ id: 'a1', name: 'Ana Ionescu' })],
  memberships: [
    { id: 'm-old', athleteId: 'a1', groupId: 'g-pp', seasonId: 's26', isMain: true, from: '2026-10-01', to: '2026-10-31' },
    { id: 'm-now', athleteId: 'a1', groupId: 'g-ib', seasonId: 's26', isMain: true, from: '2026-11-01', to: null },
  ],
});

describe('P3 screens read current memberships only (spec 2, 3.2)', () => {
  it('Sportivi "Grupa" shows the group the athlete is in now', async () => {
    const page = await athleteListPage(seed().store, readListQuery({ season: 's26' }), TODAY);
    expect(page.data[0].mainGroup?.name).toBe('Intermediari Bronze');
  });

  it('the record header shows the current main group', async () => {
    const record = await readAthleteRecord(seed().store, 'a1', 's26');
    expect(record?.header.mainGroup).toBe('Intermediari Bronze');
  });

  it('a membership created through the store is current', async () => {
    const { store } = fakeClubStore();
    const id = await store.createMembership({ athleteId: 'a1', groupId: 'g-pp', seasonId: 's26', isMain: true, from: null });
    expect((await store.memberships('a1')).find((m) => m.id === id)?.to).toBeNull();
  });
});

describe('the last group on a registration card is a current one', () => {
  it('an ended membership is not offered as the athlete\'s last group', async () => {
    const fake = fakeClubStore({
      athletes: [athleteRow({ id: 'a1', name: 'Ana Ionescu' })],
      memberships: [
        { id: 'm-old', athleteId: 'a1', groupId: 'g-pp', seasonId: 's26', isMain: true, from: '2026-10-01', to: '2026-10-31' },
        { id: 'm-now', athleteId: 'a1', groupId: 'g-ib', seasonId: 's25', isMain: true, from: '2025-10-01', to: null },
      ],
    });
    const card = (await cardMaker(fake.store))(fake.state.athletes[0]);
    expect(card.lastGroup?.name).toBe('Intermediari Bronze');
  });
});
