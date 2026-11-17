import { isoToSlash } from '../date-format';
import { JUMP_CODES, JUMP_LEVELS, pinLabel } from './catalog';
import type { JumpCode, JumpLevel, PinView, ReceivedPin } from './api-types';

/** Rules of the admin Parcurs tab (spec 4): copy, pin cells, the "Acordă" form body. Pure. */

export const PARCURS_COPY = {
  tab: 'Parcurs',
  sections: { antrenamente: 'Antrenamente', concursuri: 'Concursuri', membru: 'Membru', insigne: 'Insigne', sarituri: 'Sărituri', prietenie: 'Prietenie' },
  received: 'Primite',
  given: 'Oferite',
  awards: 'Acordate',
  award: 'Acordă',
  remove: 'Șterge',
  select: 'Selectează',
  loadFailed: 'Nu am putut încărca parcursul.',
  actionFailed: 'Nu s-a putut face modificarea.',
  from: (name: string) => `De la ${name}`,
  to: (name: string) => `Către ${name}`,
} as const;

export type AwardChoice = 'steaua' | 'test' | 'jump';
export const AWARD_OPTIONS: { value: AwardChoice; label: string }[] = [
  { value: 'steaua', label: 'Steaua antrenorului' },
  { value: 'test', label: 'Test promovat' },
  { value: 'jump', label: 'Săritură' },
];

const JUMP_NAMES: Record<JumpCode, string> = { s: 'Salchow', t: 'Toe loop', lo: 'Loop', f: 'Flip', lz: 'Lutz', a: 'Axel' };
const LEVEL_NAMES: Record<JumpLevel, string> = { 1: 'Simplu', 2: 'Dublu', 3: 'Triplu' };
export const JUMP_OPTIONS = JUMP_CODES.map((value) => ({ value, label: JUMP_NAMES[value] }));
export const LEVEL_OPTIONS = JUMP_LEVELS.map((value) => ({ value: String(value), label: LEVEL_NAMES[value] }));

export type AwardBody = { kind: AwardChoice; jump?: JumpCode; level?: JumpLevel };
export type AwardForm = { kind: AwardChoice | ''; jump: string; level: string };
export const EMPTY_AWARD_FORM: AwardForm = { kind: '', jump: '', level: '' };

const isJump = (v: string): v is JumpCode => (JUMP_CODES as readonly string[]).includes(v);
const asLevel = (v: string): JumpLevel | null => JUMP_LEVELS.find((l) => String(l) === v) ?? null;

/** The request body, or null while the form is incomplete (a jump needs its code and level). */
export function awardBody(f: AwardForm): AwardBody | null {
  if (f.kind === '') return null;
  if (f.kind !== 'jump') return { kind: f.kind };
  const level = asLevel(f.level);
  return isJump(f.jump) && level ? { kind: 'jump', jump: f.jump, level } : null;
}

export type PinCell = { key: string; src: string; label: string; date: string; count: number | null; earned: boolean };

export const pinSrc = (pin: string): string => `/parcurs/${pin}.png`;
const dateText = (iso: string | null): string => (iso ? isoToSlash(iso) ?? '' : '');

/** A pin of a section: greyed when not earned, the count only when above 1. */
export const pinCell = (p: PinView): PinCell => ({
  key: p.pin, src: pinSrc(p.pin), label: p.label || pinLabel(p.pin), date: dateText(p.earnedOn),
  count: p.count > 1 ? p.count : null, earned: p.earnedOn !== null,
});

export const friendshipPin = (design: number): string => `prietenie-${String(design).padStart(2, '0')}`;

/** A friendship pin received or given, with who is on the other side. */
export function friendshipCell(p: ReceivedPin & { to?: string }): PinCell & { id: string; who: string } {
  return {
    id: p.id, key: p.id, src: pinSrc(friendshipPin(p.design)), label: p.message, date: dateText(p.givenOn), count: null, earned: true,
    who: p.to === undefined ? PARCURS_COPY.from(p.from) : PARCURS_COPY.to(p.to),
  };
}

/** "Steaua antrenorului, 12/03/2026, Ana Pop" for the awards list. */
export const awardLine = (a: { pin: string; givenOn: string; givenBy: string }): string =>
  [pinLabel(a.pin), dateText(a.givenOn), a.givenBy].filter(Boolean).join(', ');
