import { describe, expect, it } from 'vitest';
import { PORTAL_ERRORS } from '../../copy';
import type { CoachCompetitionSource, SkaterRef } from '../competitions';
import { readCoachCompetitions } from '../competitions';
import { readCard } from '../athletes';
import { forbiddenKeysIn } from '../views';
import { coachCtx } from './coach-seed';

const ME = 'tm-andreea';
const INVALID = { ok: false, status: 400, error: PORTAL_ERRORS.invalid };

/** a-club-1 and a-scoala-1 (own groups) and a-b-1 (Virgil's) have skate slugs; a-club-2 has none. */
function seeded(source?: CoachCompetitionSource) {
  const c = coachCtx(ME);
  const link: [string, string, string][] = [['a-club-1', 'sp1', 'ana-club'], ['a-scoala-1', 'sp2', 'carmen'], ['a-b-1', 'sp3', 'eva']];
  for (const [athleteId, profileId, slug] of link) {
    c.fake.group.athletes.find((a) => a.id === athleteId)!.profileId = profileId;
    c.clubFake.state.profiles.push({ id: profileId, name: slug, slug, previousSlugs: [], showPublicPage: false, published: true, skateResultsSlug: slug });
  }
  if (source) c.competitions = source;
  return c;
}

const member = (athleteId: string, placement: number | null) => ({ athleteId, name: 'FROM SKATE', category: 'Juniori', placement, total: placement === null ? null : 100 - placement });
function fake(): CoachCompetitionSource & { sent: SkaterRef[][] } {
  const sent: SkaterRef[][] = [];
  return {
    sent,
    async club(skaters, season) {
      sent.push(skaters);
      return {
        stale: false, seasons: ['2025-2026', '2026-2027'], season: season ?? '2026-2027',
        events: [
          { eventId: 'e1', name: 'Cupa Veche', date: '2026-10-10', location: 'Cluj', members: [member('a-club-1', 2)] },
          { eventId: 'e2', name: 'Cupa Nouă', date: '2026-11-14', location: 'Reșița', members: [member('a-scoala-1', null), member('a-b-1', 1), member('a-club-1', 3), member('a-stranger', 1)] },
        ],
      };
    },
    async athlete() { return { category: 'Juniori', season: '2026-2027', count: 2, podiums: 1, recent: [{ eventName: 'Cupa Nouă', date: '2026-11-14', location: 'Reșița', placement: 3, total: 97 }] }; },
  };
}

describe('readCoachCompetitions', () => {
  it('the null source answers not available for both scopes and the card', async () => {
    const c = seeded();
    expect(await readCoachCompetitions(c, { scope: 'all' })).toEqual({ ok: true, data: { available: false } });
    expect(await readCoachCompetitions(c, { scope: 'mine' })).toEqual({ ok: true, data: { available: false } });
    expect(await readCard(c, 'a-club-1')).toMatchObject({ data: { competitions: { available: false } } });
  });

  it('passes events through, newest first, members by placement, names from Strapi, only the scope kept', async () => {
    const source = fake();
    const c = seeded(source);
    const all = await readCoachCompetitions(c, { scope: 'all' });
    if (!all.ok || !all.data.available) throw new Error('unavailable');
    expect(all.data.events.map((e) => e.eventId)).toEqual(['e2', 'e1']);
    expect(all.data.events[0].members.map((m) => [m.athleteId, m.name, m.placement])).toEqual([['a-b-1', 'Eva Cealaltă', 1], ['a-club-1', 'Ana Club', 3], ['a-scoala-1', 'Carmen Școala', null]]);
    expect(all.data.seasons).toEqual(['2026-2027', '2025-2026']);
    const mine = await readCoachCompetitions(c, { scope: 'mine' });
    if (!mine.ok || !mine.data.available) throw new Error('unavailable');
    expect(mine.data.events[0].members.map((m) => m.athleteId)).toEqual(['a-club-1', 'a-scoala-1']);
    expect(JSON.stringify(mine)).not.toMatch(/a-b-1|Eva|a-stranger|FROM SKATE/);
    expect(forbiddenKeysIn(all)).toEqual([]);
  });

  it('the source gets only slugs of club athletes in the scope, no name search', async () => {
    const source = fake();
    const c = seeded(source);
    await readCoachCompetitions(c, { scope: 'all' });
    await readCoachCompetitions(c, { scope: 'mine', season: '2025-2026' });
    expect(source.sent[0].map((s) => s.slug).sort()).toEqual(['ana-club', 'carmen', 'eva']);
    expect(source.sent[1].map((s) => s.slug).sort()).toEqual(['ana-club', 'carmen']);
    expect(source.sent.flat().every((s) => Object.keys(s).sort().join() === 'athleteId,name,slug')).toBe(true);
  });

  it('refuses a bad scope or season', async () => {
    const c = seeded(fake());
    expect(await readCoachCompetitions(c, { scope: 'x' })).toEqual(INVALID);
    expect(await readCoachCompetitions(c, { season: '2026' })).toEqual(INVALID);
  });

  it('a source that throws answers not available', async () => {
    const c = seeded({ club: async () => { throw new Error('down'); }, athlete: async () => { throw new Error('down'); } });
    expect(await readCoachCompetitions(c, {})).toEqual({ ok: true, data: { available: false } });
  });
});

describe('the card competitions', () => {
  it('zeros without a slug, the source answer with one', async () => {
    const c = seeded(fake());
    expect(await readCard(c, 'a-club-2')).toMatchObject({ data: { competitions: { available: true, category: null, season: '2026-2027', count: 0, podiums: 0, recent: [] } } });
    expect(await readCard(c, 'a-club-1')).toMatchObject({ data: { competitions: { available: true, category: 'Juniori', count: 2, podiums: 1 } } });
  });
});
