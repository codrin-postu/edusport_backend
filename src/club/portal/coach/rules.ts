import { addDays } from '../../groups/dates';
import type { SectionKind } from './api-types';
import type { GroupAccess } from './ownership';
import { canCoachCorrect } from '../window';

export type PresenceFacts = { access: GroupAccess; date: string; today: string; scheduled: boolean; added: boolean; saved: boolean; listed: boolean };
export type Right = { read: boolean; write: boolean; archived: boolean; mustIncludeMe: boolean };

const NOTHING: Right = { read: false, write: false, archived: false, mustIncludeMe: false };

/** Spec 7, 8.2, 8.3: what a coach may do with the session of a date (rulings 7 and 8). */
export function presenceRight(f: PresenceFacts): Right {
  if (f.access === 'none') return NOTHING;
  const correctable = canCoachCorrect(f.date, f.today);
  const open = f.date <= f.today;
  const archived = f.saved && !correctable;
  if (f.access === 'own') return { read: true, write: open && (!f.saved || correctable), archived, mustIncludeMe: false };
  if (f.added && !f.listed) return NOTHING;
  const inWindow = f.scheduled && f.date >= addDays(f.today, -7) && open;
  return {
    read: f.listed || (!f.saved && inWindow),
    write: open && ((!f.saved && inWindow) || (f.saved && f.listed && correctable)),
    archived, mustIncludeMe: true,
  };
}

export type LessonFacts = { listed: boolean; date: string; today: string; recorded: boolean };

export function lessonRight(f: LessonFacts): Right & { delete: boolean } {
  if (!f.listed) return { ...NOTHING, delete: false };
  const allowed = !f.recorded || canCoachCorrect(f.date, f.today);
  return { read: true, write: allowed, archived: f.recorded && !allowed, mustIncludeMe: false, delete: allowed };
}

export function programRight(access: GroupAccess, kind: SectionKind): { read: boolean; write: boolean } {
  return { read: access !== 'none', write: access === 'own' && kind === 'club' };
}

export function cardRight(own: boolean, onListedSession: boolean): { read: boolean; contact: boolean } {
  return { read: own || onListedSession, contact: own };
}
