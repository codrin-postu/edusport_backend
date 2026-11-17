import type { ClubStore, SeasonRow } from '../athletes/store';
import { seasonBounds } from '../groups/series';
import { FRIENDSHIP_MESSAGES } from './catalog';
import { lastDayOfMonth } from './month';
import type { GrantRow, ParcursStore, PinRow } from './store';

const ACTIVE = new Set(['nou', 'activ']);
const MONTHLY_SIZE = 2;

type GrantAthlete = { id: string; status: string; anonymizedAt: string | null };
type GiveResult = { ok: true; id: string } | { ok: false; code: 'SELF' | 'BAD_RECIPIENT' | 'BAD_DESIGN' | 'NO_PINS_LEFT' };

const isActive = (a: { status: string; anonymizedAt: string | null }): boolean => ACTIVE.has(a.status) && !a.anonymizedAt;
const inSeason = (ym: string, seasons: SeasonRow[]): boolean =>
  seasons.some((s) => {
    const b = seasonBounds(s);
    return b.start.slice(0, 7) <= ym && ym <= b.end.slice(0, 7);
  });
const unexpired = (g: GrantRow, today: string): boolean => today <= g.expiresOn;
const used = (g: GrantRow, pins: PinRow[]): number => pins.filter((p) => p.grantId === g.id).length;

/** One monthly grant of 2 pins per active athlete while the month lies in a season; never for past months. */
export async function ensureGrants(s: ParcursStore, d: { athlete: GrantAthlete; seasons: SeasonRow[]; today: string }): Promise<void> {
  const ym = d.today.slice(0, 7);
  if (!isActive(d.athlete) || !inSeason(ym, d.seasons)) return;
  const source = `m:${ym}`;
  const has = async (): Promise<boolean> => (await s.grants({ athleteId: d.athlete.id })).some((g) => g.source === source);
  if (await has()) return;
  await s.transaction(async () => {
    await s.lockAthlete(d.athlete.id);
    if (await has()) return;
    await s.addGrant({ athleteId: d.athlete.id, source, size: MONTHLY_SIZE, createdOn: `${ym}-01`, expiresOn: lastDayOfMonth(ym) });
  });
}

export function pinsLeft(grants: GrantRow[], pins: PinRow[], today: string): number {
  return grants.filter((g) => unexpired(g, today)).reduce((sum, g) => sum + Math.max(0, g.size - used(g, pins)), 0);
}

const validDesign = (n: number): boolean => Number.isInteger(n) && n >= 1 && n <= FRIENDSHIP_MESSAGES.length;
const byAge = (a: GrantRow, b: GrantRow): number => a.createdOn.localeCompare(b.createdOn) || a.id.localeCompare(b.id);

export async function givePin(
  s: ParcursStore,
  input: { giverId: string; recipientId: string; design: number; today: string; activeIds: Set<string> },
): Promise<GiveResult> {
  if (input.giverId === input.recipientId) return { ok: false, code: 'SELF' };
  if (!input.activeIds.has(input.recipientId)) return { ok: false, code: 'BAD_RECIPIENT' };
  if (!validDesign(input.design)) return { ok: false, code: 'BAD_DESIGN' };
  return s.transaction(async () => {
    await s.lockAthlete(input.giverId);
    const grants = await s.grants({ athleteId: input.giverId });
    const pins = await s.pins({ giverId: input.giverId });
    const toRecipient = new Set(pins.filter((p) => p.recipientId === input.recipientId).map((p) => p.grantId));
    const grant = grants
      .filter((g) => unexpired(g, input.today) && used(g, pins) < g.size && !toRecipient.has(g.id))
      .sort(byAge)[0];
    if (!grant) return { ok: false as const, code: 'NO_PINS_LEFT' as const };
    const id = await s.addPin({ grantId: grant.id, giverId: input.giverId, recipientId: input.recipientId, design: input.design, givenOn: input.today });
    return { ok: true as const, id };
  });
}

export async function deletePin(s: ParcursStore, pinId: string): Promise<{ ok: true } | { ok: false; code: 'NOT_FOUND' }> {
  return s.transaction(async () => {
    const pins = await s.pins({});
    if (!pins.some((p) => p.id === pinId)) return { ok: false as const, code: 'NOT_FOUND' as const };
    await s.deletePin(pinId);
    return { ok: true as const };
  });
}

/** "Ana Popescu" becomes "Ana P." */
export const shortName = (name: string): string => {
  const words = name.split(/\s+/).filter(Boolean);
  const last = words.length > 1 ? words[words.length - 1] : '';
  return last ? `${words[0]} ${last[0].toUpperCase()}.` : words[0] ?? '';
};

/** Every other active athlete, by short name. */
export async function recipients(club: ClubStore, giverId: string): Promise<{ id: string; name: string }[]> {
  const all = await club.athletes();
  return all
    .filter((a) => a.id !== giverId && isActive(a))
    .map((a) => ({ id: a.id, name: shortName(a.name ?? '') }))
    .sort((a, b) => a.name.localeCompare(b.name, 'ro'));
}

/** The friends the giver can still give a pin to now: those already given one on every unexpired grant with room are left out. */
export async function availableRecipients(
  club: ClubStore, s: ParcursStore, d: { giverId: string; today: string },
): Promise<{ id: string; name: string }[]> {
  const [all, grants, pins] = await Promise.all([recipients(club, d.giverId), s.grants({ athleteId: d.giverId }), s.pins({ giverId: d.giverId })]);
  const open = grants.filter((g) => unexpired(g, d.today) && used(g, pins) < g.size);
  if (open.length === 0) return all;
  const given = (grantId: string, recipientId: string): boolean => pins.some((p) => p.grantId === grantId && p.recipientId === recipientId);
  return all.filter((r) => !open.every((g) => given(g.id, r.id)));
}
