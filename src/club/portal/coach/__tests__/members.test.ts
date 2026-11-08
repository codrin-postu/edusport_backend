import { describe, expect, it } from 'vitest';
import { PORTAL_ERRORS } from '../../copy';
import { moveMember, readChangeBody, removeMember } from '../members';
import { forbiddenKeysIn } from '../views';
import { coachCtx } from './coach-seed';

const ME = 'tm-andreea';
const NO_ACCESS = { ok: false, status: 403, error: PORTAL_ERRORS.noAccess };
const INVALID = { ok: false, status: 400, error: PORTAL_ERRORS.invalid };
const PICK = { ok: false, status: 400, error: 'Alege grupa.' };
const snapshot = (c: ReturnType<typeof coachCtx>) => JSON.stringify([c.fake.group.memberships, c.fake.group.history]);

describe('readChangeBody', () => {
  it('reads dates between today and the season end only', () => {
    expect(readChangeBody({ toGroupId: 'g', from: '2026-11-20' }, '2026-11-20', '2027-05-31', true)).toEqual({ toGroupId: 'g', from: '2026-11-20' });
    expect(readChangeBody({ from: '2027-05-31' }, '2026-11-20', '2027-05-31', false)).toEqual({ toGroupId: null, from: '2027-05-31' });
    for (const from of ['2026-11-19', '2027-06-01', '12.11.2026', undefined, 5]) expect(readChangeBody({ toGroupId: 'g', from }, '2026-11-20', '2027-05-31', true)).toBeNull();
    expect(readChangeBody(null, '2026-11-20', '2027-05-31', true)).toBeNull();
  });
});

describe('moveMember', () => {
  it('moves between own groups from today, with the coach as actor and no extra keys', async () => {
    const c = coachCtx(ME);
    const out = await moveMember(c, 'g-club-a', 'a-club-1', { toGroupId: 'g-scoala-a', from: '2026-11-20' });
    expect(out).toEqual({ ok: true, data: { athleteName: 'Ana Club', groupName: 'Școala A', from: '2026-11-20', toast: 'Salvat.' } });
    expect(forbiddenKeysIn(out)).toEqual([]);
    expect(c.fake.group.history.length).toBeGreaterThan(0);
    expect(c.fake.group.history.every((h) => h.actor === 'Antrenor Andreea Pascu')).toBe(true);
    expect(c.fake.group.memberships.find((m) => m.athleteId === 'a-club-1' && m.groupId === 'g-scoala-a')).toMatchObject({ from: '2026-11-20' });
  });

  it('refuses another coach group as target or source and writes nothing', async () => {
    const c = coachCtx(ME);
    const before = snapshot(c);
    expect(await moveMember(c, 'g-club-a', 'a-club-1', { toGroupId: 'g-club-b', from: '2026-11-20' })).toEqual(NO_ACCESS);
    expect(await moveMember(c, 'g-club-b', 'a-b-1', { toGroupId: 'g-club-a', from: '2026-11-20' })).toEqual(NO_ACCESS);
    expect(snapshot(c)).toBe(before);
  });

  it('refuses an inactive, missing or same target with "Alege grupa."', async () => {
    const c = coachCtx(ME);
    expect(await moveMember(c, 'g-club-a', 'a-club-1', { toGroupId: 'g-old', from: '2026-11-20' })).toEqual(PICK);
    expect(await moveMember(c, 'g-club-a', 'a-club-1', { toGroupId: 'g-club-a', from: '2026-11-20' })).toEqual(PICK);
    expect(await moveMember(c, 'g-club-a', 'a-club-1', { from: '2026-11-20' })).toEqual(PICK);
  });

  it('refuses a bad date', async () => {
    const c = coachCtx(ME);
    for (const from of ['2026-11-19', '2027-06-01', '12.11.2026']) expect(await moveMember(c, 'g-club-a', 'a-club-1', { toGroupId: 'g-scoala-a', from })).toEqual(INVALID);
  });

  it('answers 409 for a child without a current membership in the group', async () => {
    const c = coachCtx(ME);
    expect(await moveMember(c, 'g-club-a', 'a-free', { toGroupId: 'g-scoala-a', from: '2026-11-20' })).toMatchObject({ ok: false, status: 409 });
  });
});

describe('removeMember', () => {
  it('ends the row the day before the date', async () => {
    const c = coachCtx(ME);
    const out = await removeMember(c, 'g-scoala-a', 'a-scoala-2', { from: '2026-11-20' });
    expect(out).toEqual({ ok: true, data: { athleteName: 'Dan Școala', groupName: 'Școala A', from: '2026-11-20', toast: 'Salvat.' } });
    expect(forbiddenKeysIn(out)).toEqual([]);
    expect(c.fake.group.memberships.find((m) => m.id === 'gm-4')).toMatchObject({ to: '2026-11-19' });
  });

  it('refuses another coach group, a bad date and a second removal', async () => {
    const c = coachCtx(ME);
    expect(await removeMember(c, 'g-club-b', 'a-b-1', { from: '2026-11-20' })).toEqual(NO_ACCESS);
    expect(await removeMember(c, 'g-scoala-a', 'a-scoala-2', { from: '2020-01-01' })).toEqual(INVALID);
    await removeMember(c, 'g-scoala-a', 'a-scoala-2', { from: '2026-11-25' });
    expect(await removeMember(c, 'g-scoala-a', 'a-scoala-2', { from: '2026-11-26' })).toMatchObject({ ok: false, status: 409 });
  });
});
