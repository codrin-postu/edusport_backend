import { countWords } from '../ro-count';
import type { JumpCode, JumpLevel, PinId } from './api-types';

/** Parcurs pins are computed from this date on (Task 2 uses it). */
export const PARCURS_FROM = '2026-12-01';

export const ANTRENAMENTE_THRESHOLDS = [25, 50, 100, 250] as const;
export const CONCURSURI_THRESHOLDS = [1, 2, 5, 10, 25] as const;
export const MEMBRU_MAX_YEARS = 15;

export const JUMP_CODES: readonly JumpCode[] = ['s', 't', 'lo', 'f', 'lz', 'a'];
export const JUMP_LEVELS: readonly JumpLevel[] = [1, 2, 3];

/** One fixed message per friendship design; index = design - 1. */
export const FRIENDSHIP_MESSAGES: readonly string[] = [
  'Bate palma!', 'Ai strălucit.', 'Te susțin!', 'Un gând bun pentru tine.', 'Mă bucur că ești în echipă.',
  'Crești frumos.', 'Mi-ai făcut ziua mai bună.', 'Cred în tine!', 'Patinezi frumos.', 'Prieteni pe gheață.',
  'Echipă bună!', 'Te ridici de fiecare dată.', 'Ai fost o vedetă.', 'Ușor ca un fluture.', 'Hai la o ciocolată caldă!',
];

const JUMP_NAMES: Record<JumpCode, string> = { s: 'Salchow', t: 'Toe loop', lo: 'Loop', f: 'Flip', lz: 'Lutz', a: 'Axel' };
const LEVEL_NAMES: Record<JumpLevel, string> = { 1: 'Simplu', 2: 'Dublu', 3: 'Triplu' };

const FIXED_LABELS: Record<string, string> = {
  'prima-lectie': 'Prima lecție',
  'concursuri-1': 'Primul concurs',
  'locul-1': 'Locul 1',
  podium: 'Podium',
  prezenta: 'Prezență 100%',
  manusi: 'Prima prietenie',
  steaua: 'Steaua antrenorului',
  test: 'Test promovat',
};

const jumpLabel = (id: PinId): string | null => {
  const m = /^saritura-([123])(s|t|lo|f|lz|a)$/.exec(id);
  return m ? `${LEVEL_NAMES[Number(m[1]) as JumpLevel]} ${JUMP_NAMES[m[2] as JumpCode]}` : null;
};

const countedLabel = (id: PinId): string | null => {
  const m = /^(antrenamente|concursuri|membru)-(\d+)$/.exec(id);
  if (!m) return null;
  const n = Number(m[2]);
  if (m[1] === 'antrenamente') return countWords(n, 'antrenament', 'antrenamente');
  if (m[1] === 'concursuri') return countWords(n, 'concurs', 'concursuri');
  return `Membru ${n} ${n === 1 ? 'an' : 'ani'}`;
};

/** Romanian display name of a pin. */
export function pinLabel(id: PinId): string {
  return FIXED_LABELS[id] ?? jumpLabel(id) ?? countedLabel(id) ?? id;
}
