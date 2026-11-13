import { describe, expect, it } from 'vitest';
import type { AdminRow } from '../../../admin-login/admins';
import { ROLE_CODES } from '../../../roles/map';
import { coachSchoolEdit } from '../school-edit';

const row = (over: Partial<AdminRow> = {}): AdminRow => ({
  id: 1, email: 'Ana@Club.ro', firstname: null, lastname: null, isActive: true, blocked: null, passwordHash: null, roleCodes: [ROLE_CODES.clubAdmin], ...over,
});
const finder = (admin: AdminRow | null) => async () => admin;

describe('coachSchoolEdit', () => {
  it('is false for a plain coach (no admin with that e-mail)', async () => {
    expect(await coachSchoolEdit('ana@club.ro', finder(null))).toBe(false);
  });

  it('is true for an active club admin and for a super admin', async () => {
    expect(await coachSchoolEdit('ana@club.ro', finder(row()))).toBe(true);
    expect(await coachSchoolEdit('ana@club.ro', finder(row({ roleCodes: [ROLE_CODES.superAdmin] })))).toBe(true);
  });

  it('is false for an admin without the club area (site editor, unmapped role, no role)', async () => {
    expect(await coachSchoolEdit('ana@club.ro', finder(row({ roleCodes: [ROLE_CODES.siteEditor] })))).toBe(false);
    expect(await coachSchoolEdit('ana@club.ro', finder(row({ roleCodes: ['strapi-editor'] })))).toBe(false);
    expect(await coachSchoolEdit('ana@club.ro', finder(row({ roleCodes: [] })))).toBe(false);
  });

  it('is false for a blocked or inactive admin', async () => {
    expect(await coachSchoolEdit('ana@club.ro', finder(row({ blocked: true })))).toBe(false);
    expect(await coachSchoolEdit('ana@club.ro', finder(row({ isActive: false })))).toBe(false);
  });

  it('matches the e-mail without regard to case or surrounding spaces', async () => {
    const seen: string[] = [];
    const find = async (email: string) => { seen.push(email); return row({ email: 'ANA@club.RO' }); };
    expect(await coachSchoolEdit('  ana@CLUB.ro ', find)).toBe(true);
    expect(seen).toEqual(['ana@CLUB.ro']);
  });

  it('is false for a finder that returns another admin, or for an empty e-mail', async () => {
    expect(await coachSchoolEdit('ana@club.ro', finder(row({ email: 'altcineva@club.ro' })))).toBe(false);
    expect(await coachSchoolEdit('  ', finder(row()))).toBe(false);
    expect(await coachSchoolEdit(null, finder(row()))).toBe(false);
  });
});
