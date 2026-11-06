import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { actorName } from '../../../presence/lessons/create';
import { groupAccess, ownAthlete, ownGroupIds } from '../ownership';
import { C_GROUPS, coachCtx } from './coach-seed';
import { member } from '../../../groups/__tests__/fake-group-store';

const me = 'tm-andreea';
const group = (id: string) => C_GROUPS.find((g) => g.id === id) ?? null;

describe('group ownership is read from the group row', () => {
  it('own groups are the active ones that list the coach', () => {
    expect([...ownGroupIds(C_GROUPS, me)].sort()).toEqual(['g-club-a', 'g-scoala-a']);
  });

  it('an inactive own group, an unknown group and a null group are none', () => {
    expect(groupAccess(group('g-old'), me)).toBe('none');
    expect(groupAccess(null, me)).toBe('none');
  });

  it('a group whose coachIds lost the team member is other', () => {
    const lost = { ...C_GROUPS[0], coachIds: ['tm-virgil'] };
    expect(groupAccess(group('g-club-a'), me)).toBe('own');
    expect(groupAccess(lost, me)).toBe('other');
    expect(groupAccess(group('g-club-b'), me)).toBe('other');
  });
});

describe('ownAthlete', () => {
  const own = new Set(['g-club-a']);
  const today = '2026-11-20';
  it('needs a current-season membership in an own group that runs today', () => {
    expect(ownAthlete([member({ id: 'm', athleteId: 'a', groupId: 'g-club-a' })], own, 'a', 's26', today)).toBe(true);
    expect(ownAthlete([member({ id: 'm', athleteId: 'a', groupId: 'g-club-b' })], own, 'a', 's26', today)).toBe(false);
  });

  it('is false for last season and for a membership that ended yesterday', () => {
    expect(ownAthlete([member({ id: 'm', athleteId: 'a', groupId: 'g-club-a', seasonId: 's25' })], own, 'a', 's26', today)).toBe(false);
    expect(ownAthlete([member({ id: 'm', athleteId: 'a', groupId: 'g-club-a', to: '2026-11-19' })], own, 'a', 's26', today)).toBe(false);
    expect(ownAthlete([member({ id: 'm', athleteId: 'a', groupId: 'g-club-a', to: '2026-11-20' })], own, 'a', 's26', today)).toBe(true);
  });
});

describe('coach contexts', () => {
  it('the phase 5 actor name falls back to "Antrenor <nume>" and the group actor is the same', async () => {
    const c = coachCtx(me);
    expect(await actorName(c.presence)).toBe('Antrenor Andreea Pascu');
    expect(c.groups.actor).toBe('Antrenor Andreea Pascu');
    expect(c.club.actor).toBe('Antrenor Andreea Pascu');
  });

  it('coach files import nothing of the money side', () => {
    const dir = join(__dirname, '..');
    const text = ['context.ts', 'ownership.ts'].map((f) => readFileSync(join(dir, f), 'utf8')).join('\n');
    expect(text).not.toMatch(/money-api|\/due\/|\/payments\/|billing/);
  });
});
