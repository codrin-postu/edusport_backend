import type { Core } from '@strapi/strapi';
import { describe, expect, it } from 'vitest';
import { strapiClubStore, toAthleteRow, toDuplicateRow, toProfileRows, toRegistrationRow } from '../strapi-store';

/** Records the knex chain of a row lock; `transaction` hands out one fake trx. */
function lockingStrapi(calls: string[]): Core.Strapi {
  const chain = (table: string) => {
    const step = (text: string) => {
      calls.push(`${table} ${text}`);
      return q;
    };
    const q = {
      transacting: (trx: string) => step(`in ${trx}`),
      forUpdate: () => step('for update'),
      where: (col: string, id: string) => step(`${col}=${id}`),
      select: async () => [],
    };
    return q;
  };
  const db = { getConnection: chain, transaction: async (work: (a: { trx: string }) => Promise<unknown>) => work({ trx: 'trx' }) };
  return { db } as unknown as Core.Strapi;
}

describe('row locks (spec 4.7, polish 12)', () => {
  it('locks the athlete row by documentId inside the transaction, like the registration row', async () => {
    const calls: string[] = [];
    const store = strapiClubStore(lockingStrapi(calls));
    await store.transaction(async () => {
      await store.lockRegistration('r1');
      await store.lockAthlete('a1');
    });
    expect(calls).toEqual([
      'registration_submissions in trx', 'registration_submissions for update', 'registration_submissions document_id=r1',
      'athletes in trx', 'athletes for update', 'athletes document_id=a1',
    ]);
  });

  it('outside a transaction a lock does nothing', async () => {
    const calls: string[] = [];
    await strapiClubStore(lockingStrapi(calls)).lockAthlete('a1');
    expect(calls).toEqual([]);
  });
});

describe('Strapi rows -> store rows', () => {
  it('reads an athlete with its profile link', () => {
    expect(toAthleteRow({
      documentId: 'a1', name: 'Maria Pop', birthDate: '2016-03-14', contactName: null, phone: '07', email: null,
      status: 'inactiv', dataIncomplete: true, publicProfile: { documentId: 'sp1' }, notes: 'Alergie la arahide', updatedAt: new Date('2026-10-01T10:00:00.000Z'), createdAt: new Date('2026-09-01T08:00:00.000Z'),
    })).toEqual({
      id: 'a1', name: 'Maria Pop', birthDate: '2016-03-14', contactName: null, phone: '07', email: null,
      status: 'inactiv', dataIncomplete: true, profileId: 'sp1', notes: 'Alergie la arahide', updatedAt: '2026-10-01T10:00:00.000Z', createdAt: '2026-09-01T08:00:00.000Z', anonymizedAt: null,
    });
  });

  it('reads a registration with its links, match and confirmation', () => {
    const row = toRegistrationRow({
      documentId: 'r1', registrationNumber: '2026-0142', childName: 'Maria', childBirthDate: '14.03.2016', parentName: 'Ana', phone: '07', email: 'e',
      status: 'Contactat', archived: null, season: '2026-2027', seasonRef: { documentId: 's26' }, section: { documentId: 'afi' },
      athlete: null, matchAthlete: { documentId: 'a1' }, matchLevel: 'sigur', childBirthDateParsed: '2016-03-14',
      membershipAnswer: 'da', lastSeason: 'Nu a participat', subscriptionChoice: { priceItemName: 'X' }, confirmation: null, submittedAt: '2026-10-03T11:22:00.000Z',
    });
    expect(row).toMatchObject({ id: 'r1', number: '2026-0142', status: 'Contactat', archived: false, seasonId: 's26', sectionId: 'afi', athleteId: null, matchAthleteId: 'a1', matchLevel: 'sigur', membershipAnswer: 'da' });
    expect(toRegistrationRow({ documentId: 'r2', status: 'x', matchLevel: 'alt', membershipAnswer: 'poate', confirmation: { other: 1 } })).toMatchObject({
      status: 'Nou', matchLevel: null, membershipAnswer: null, confirmation: null, childName: '',
    });
  });

  it('merges the draft and published rows of a profile; the published row decides "Public"', () => {
    expect(toProfileRows([
      { documentId: 'sp1', name: 'Maria', slug: 'maria', showPublicPage: false, publishedAt: null, previousSlugs: null },
      { documentId: 'sp1', name: 'Maria', slug: 'maria', showPublicPage: true, publishedAt: '2026-01-01', previousSlugs: ['m'] },
      { documentId: 'sp2', name: 'Ion', slug: 'ion', showPublicPage: true, publishedAt: null, previousSlugs: 'x' },
    ])).toEqual([
      { id: 'sp1', name: 'Maria', slug: 'maria', previousSlugs: ['m'], showPublicPage: true, published: true },
      { id: 'sp2', name: 'Ion', slug: 'ion', previousSlugs: [], showPublicPage: false, published: false },
    ]);
  });

  it('takes name and slug from the published row, whatever the row order', () => {
    expect(toProfileRows([
      { documentId: 'sp1', name: 'Maria', slug: 'maria', showPublicPage: true, publishedAt: '2026-01-01', previousSlugs: null },
      { documentId: 'sp1', name: 'Maria Draft', slug: 'maria-draft', showPublicPage: false, publishedAt: null, previousSlugs: null },
    ])).toEqual([{ id: 'sp1', name: 'Maria', slug: 'maria', previousSlugs: [], showPublicPage: true, published: true }]);
  });

  it('reads a duplicate pair; a pair without the flag is not dismissed', () => {
    expect(toDuplicateRow({ documentId: 'd1', first: { documentId: 'a1' }, second: { documentId: 'a2' }, dismissed: true }))
      .toEqual({ id: 'd1', firstId: 'a1', secondId: 'a2', dismissed: true });
    expect(toDuplicateRow({ documentId: 'd2', first: { documentId: 'a1' }, second: null, dismissed: null }))
      .toEqual({ id: 'd2', firstId: 'a1', secondId: '', dismissed: false });
  });
});
