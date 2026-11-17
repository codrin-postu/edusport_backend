import type { AthleteRow, ClubStore } from '../athletes/store';
import { isAnonymized } from '../personal-data/anonymize-plan';
import type { PresenceStore } from '../presence/store';
import type { Parcurs, ParcursStaff, PinId, PinView, ReceivedPin } from './api-types';
import { awardPins } from './awards';
import { FRIENDSHIP_MESSAGES } from './catalog';
import { countedPins } from './counted';
import { countedFacts, type FactsDeps } from './facts';
import { ensureGrants, pinsLeft, shortName } from './grants';
import type { AwardRow, ParcursStore, PinRow } from './store';

/** What a Parcurs read needs: the stores and the results source. */
export type ParcursDeps = { store: ParcursStore; results: FactsDeps['results']; presence: PresenceStore; club: ClubStore };
/** The staff read also names the admins that gave awards. */
export type ParcursStaffDeps = ParcursDeps & { adminNames(ids: string[]): Promise<Record<string, string>> };

export const FORMER_ATHLETE = 'Fost sportiv';

const INSIGNE_ORDER = ['locul-1', 'podium', 'prezenta', 'steaua', 'test', 'manusi'];

type NameOf = (athleteId: string) => string;

const fullNames = (athletes: AthleteRow[]): NameOf => {
  const names = new Map(athletes.map((a) => [a.id, isAnonymized(a) || !a.name ? null : a.name]));
  return (id) => names.get(id) ?? FORMER_ATHLETE;
};
const shortNames = (full: NameOf): NameOf => (id) => {
  const name = full(id);
  return name === FORMER_ATHLETE ? name : shortName(name);
};

const toReceived = (p: PinRow, from: string): ReceivedPin => ({
  id: p.id, design: p.design, message: FRIENDSHIP_MESSAGES[p.design - 1] ?? '', from, givenOn: p.givenOn,
});

const earliest = (pins: PinRow[]): string | null => pins.map((p) => p.givenOn).sort()[0] ?? null;

const byPinOrder = (a: PinView, b: PinView): number => INSIGNE_ORDER.indexOf(a.pin) - INSIGNE_ORDER.indexOf(b.pin);

type Loaded = { athlete: AthleteRow; awards: AwardRow[]; given: PinRow[]; received: PinRow[]; left: number; pins: ReturnType<typeof countedPins>; people: AthleteRow[] };

async function load(d: ParcursDeps, athleteId: string, today: string): Promise<Loaded> {
  const athlete = await d.club.athlete(athleteId);
  if (!athlete) throw new Error('parcurs: athlete not found');
  await ensureGrants(d.store, { athlete, seasons: await d.presence.seasons(), today });
  const [facts, awards, grants, given, received, people] = await Promise.all([
    countedFacts(d, athleteId, today), d.store.awards({ athleteId }), d.store.grants({ athleteId }),
    d.store.pins({ giverId: athleteId }), d.store.pins({ recipientId: athleteId }), d.club.athletes(),
  ]);
  const pins = countedPins({ ...facts, firstPinGivenOn: earliest(given) });
  return { athlete, awards, given, received, left: pinsLeft(grants, given, today), pins, people };
}

function view(l: Loaded, from: NameOf): Parcurs {
  const earned = awardPins(l.awards);
  return {
    antrenamente: l.pins.antrenamente, concursuri: l.pins.concursuri, membru: l.pins.membru,
    insigne: [...l.pins.insigne, ...earned.insigne].sort(byPinOrder), sarituri: earned.sarituri,
    received: l.received.map((p) => toReceived(p, from(p.giverId))), pinsLeft: l.left,
  };
}

/** The athlete's Parcurs. Ensures this month's grant first, so a read may write (once). */
export async function readParcurs(d: ParcursDeps, athleteId: string, today: string): Promise<Parcurs> {
  const l = await load(d, athleteId, today);
  return view(l, shortNames(fullNames(l.people)));
}

const awardPinId = (a: AwardRow): PinId => (a.kind === 'jump' ? `saritura-${a.level}${a.jump}` : a.kind);

async function giverNames(d: ParcursStaffDeps, awards: AwardRow[]): Promise<(by: AwardRow['givenBy']) => string> {
  const team = new Map((await d.presence.teamMembers()).map((t) => [t.id, t.name]));
  const adminIds = awards.flatMap((a) => ('adminId' in a.givenBy ? [a.givenBy.adminId] : []));
  const admins = adminIds.length > 0 ? await d.adminNames(adminIds) : {};
  return (by) => ('teamMemberId' in by ? team.get(by.teamMemberId) : admins[by.adminId]) ?? '';
}

/** The Parcurs for the coach and the admin: full names, awards with who gave them, and the pins the athlete gave. */
export async function readParcursStaff(d: ParcursStaffDeps, athleteId: string, today: string): Promise<ParcursStaff> {
  const l = await load(d, athleteId, today);
  const name = fullNames(l.people);
  const by = await giverNames(d, l.awards);
  return {
    ...view(l, name),
    awards: l.awards.map((a) => ({ id: a.id, pin: awardPinId(a), givenOn: a.givenOn, givenBy: by(a.givenBy) })),
    given: l.given.map((p) => ({ ...toReceived(p, name(p.giverId)), to: name(p.recipientId) })),
  };
}
