import { describe, expect, it } from 'vitest';
import { awardData, toAwardRow } from '../strapi-store';

const raw = { documentId: 'x', athlete: { documentId: 'a1' }, kind: 'jump', jump: 'lz', level: 2, givenByAdminId: 7, givenOn: '2026-11-01' };

describe('badge-award mapping', () => {
  it('maps a good row', () => {
    expect(toAwardRow(raw)).toEqual({ id: 'x', athleteId: 'a1', kind: 'jump', jump: 'lz', level: 2, givenBy: { adminId: '7' }, givenOn: '2026-11-01' });
    expect(toAwardRow({ ...raw, givenByAdminId: null, givenByTeamMember: { documentId: 't1' } }).givenBy).toEqual({ teamMemberId: 't1' });
  });
  it.each([
    ['kind', { kind: 'other' }], ['giver', { givenByAdminId: null }], ['jump', { jump: 'zz' }], ['level', { level: 4 }],
  ])('throws on a corrupt %s', (_n, patch) => {
    expect(() => toAwardRow({ ...raw, ...patch })).toThrow();
  });
  it('rejects a non-numeric admin id', () => {
    expect(() => awardData({ athleteId: 'a', kind: 'steaua', jump: null, level: null, givenBy: { adminId: 'abc' }, givenOn: '2026-11-01' })).toThrow(/integer/);
    expect(() => awardData({ athleteId: 'a', kind: 'steaua', jump: null, level: null, givenBy: { adminId: '' }, givenOn: '2026-11-01' })).toThrow();
  });
});
