import type { JumpCode, JumpLevel, PinView } from './api-types';
import { JUMP_CODES, JUMP_LEVELS, pinLabel } from './catalog';
import type { AwardRow, ParcursStore } from './store';

export type GiveAwardInput = {
  athleteId: string;
  kind: 'steaua' | 'test' | 'jump';
  jump?: JumpCode;
  level?: JumpLevel;
  by: AwardRow['givenBy'];
  today: string;
};

const validJump = (jump?: JumpCode, level?: JumpLevel): boolean =>
  jump !== undefined && level !== undefined && JUMP_CODES.includes(jump) && JUMP_LEVELS.includes(level);

export async function giveAward(s: ParcursStore, input: GiveAwardInput): Promise<{ ok: true; id: string } | { ok: false; code: 'BAD_JUMP' }> {
  const isJump = input.kind === 'jump';
  if (isJump && !validJump(input.jump, input.level)) return { ok: false, code: 'BAD_JUMP' };
  return s.transaction(async () => {
    await s.lockAthlete(input.athleteId);
    const id = await s.addAward({
      athleteId: input.athleteId,
      kind: input.kind,
      jump: isJump ? input.jump ?? null : null,
      level: isJump ? input.level ?? null : null,
      givenBy: input.by,
      givenOn: input.today,
    });
    return { ok: true as const, id };
  });
}

export async function removeAward(s: ParcursStore, id: string): Promise<{ ok: true } | { ok: false; code: 'NOT_FOUND' }> {
  return s.transaction(async () => {
    if (!(await s.awards({})).some((a) => a.id === id)) return { ok: false as const, code: 'NOT_FOUND' as const };
    await s.deleteAward(id);
    return { ok: true as const };
  });
}

const view = (pin: string, earnedOn: string | null, count: number): PinView => ({ pin, label: pinLabel(pin), earnedOn, count });

const earliest = (dates: string[]): string | null => dates.reduce<string | null>((min, d) => (min === null || d < min ? d : min), null);

function countedInsigna(awards: AwardRow[], kind: 'steaua' | 'test'): PinView {
  const dates = awards.filter((a) => a.kind === kind).map((a) => a.givenOn);
  return view(kind, dates.reduce<string | null>((max, d) => (max === null || d > max ? d : max), null), dates.length);
}

/** A jump level is earned by its own record (earliest date wins), else by the earliest higher level of the same jump. */
function jumpPin(jumps: AwardRow[], code: JumpCode, level: JumpLevel): PinView {
  const ofCode = jumps.filter((a) => a.jump === code);
  const own = earliest(ofCode.filter((a) => a.level === level).map((a) => a.givenOn));
  const implied = earliest(ofCode.filter((a) => (a.level ?? 0) > level).map((a) => a.givenOn));
  const earnedOn = own ?? implied;
  return view(`saritura-${level}${code}`, earnedOn, earnedOn ? 1 : 0);
}

export function awardPins(awards: AwardRow[]): { insigne: PinView[]; sarituri: PinView[][] } {
  const jumps = awards.filter((a) => a.kind === 'jump');
  return {
    insigne: [countedInsigna(awards, 'steaua'), countedInsigna(awards, 'test')],
    sarituri: JUMP_LEVELS.map((level) => JUMP_CODES.map((code) => jumpPin(jumps, code, level))),
  };
}
