import { refuse, type AdminResult } from '../admin-result';
import type { JumpCode, JumpLevel, ParcursStaff } from './api-types';
import { giveAward, removeAward } from './awards';
import { deletePin } from './grants';
import { readParcursStaff, type ParcursStaffDeps } from './read';
import type { AwardRow } from './store';

const KINDS: readonly string[] = ['steaua', 'test', 'jump'];

type AwardKind = AwardRow['kind'];

/** `jump` and `level` are passed on as sent: `giveAward` rejects a code or level that is not in the catalog. */
function readAwardBody(body: unknown): { kind: AwardKind; jump?: JumpCode; level?: JumpLevel } | null {
  if (typeof body !== 'object' || body === null) return null;
  const { kind, jump, level } = body as Record<string, unknown>;
  if (typeof kind !== 'string' || !KINDS.includes(kind)) return null;
  return {
    kind: kind as AwardKind,
    jump: typeof jump === 'string' ? (jump as JumpCode) : undefined,
    level: typeof level === 'number' ? (level as JumpLevel) : undefined,
  };
}

/** Coach or admin gives an award; the answer is the athlete's fresh staff Parcurs. */
export async function addAward(
  d: ParcursStaffDeps, athleteId: string, body: unknown, by: AwardRow['givenBy'], today: string,
): Promise<AdminResult<ParcursStaff>> {
  const read = readAwardBody(body);
  if (!read) return refuse(400, 'BAD_KIND');
  const given = await giveAward(d.store, { athleteId, kind: read.kind, ...read, by, today });
  return given.ok === true ? { ok: true, data: await readParcursStaff(d, athleteId, today) } : refuse(400, given.code);
}

/** Removes an award of this athlete only: an award of another athlete is not found. */
export async function removeAwardOf(
  d: ParcursStaffDeps, athleteId: string, awardId: string, today: string,
): Promise<AdminResult<ParcursStaff>> {
  const mine = (await d.store.awards({ athleteId })).some((a) => a.id === awardId);
  if (!mine || !(await removeAward(d.store, awardId)).ok) return refuse(404, 'NOT_FOUND');
  return { ok: true, data: await readParcursStaff(d, athleteId, today) };
}

/** Removes a friendship pin the athlete gave or received; a pin of two other athletes is not found. */
export async function removePinOf(
  d: ParcursStaffDeps, athleteId: string, pinId: string, today: string,
): Promise<AdminResult<ParcursStaff>> {
  const pins = [...(await d.store.pins({ giverId: athleteId })), ...(await d.store.pins({ recipientId: athleteId }))];
  if (!pins.some((p) => p.id === pinId) || !(await deletePin(d.store, pinId)).ok) return refuse(404, 'NOT_FOUND');
  return { ok: true, data: await readParcursStaff(d, athleteId, today) };
}
